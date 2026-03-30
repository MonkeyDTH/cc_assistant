use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use super::claude_dir;

/// 解码项目目录名为原始路径
/// Claude Code 编码规则：
///   路径分隔符（\ 或 /）→ 单个 -
///   原始连字符（-）      → 双 --
///   Windows 盘符 D:\    → D--（首段双横线）
fn decode_project_path(encoded: &str) -> String {
    let parts: Vec<&str> = encoded.splitn(2, "--").collect();
    if parts.len() == 2 && parts[0].len() == 1 {
        // Windows 路径：D--Projects-Personal-playground → D:\Projects\Personal\playground
        let rest = parts[1]
            .replace("--", "\x00") // 先保护原始连字符（双横线）
            .replace('-', "\\")    // 路径分隔符（单横线）→ 反斜杠
            .replace('\x00', "-"); // 恢复原始连字符
        format!("{}:\\{}", parts[0].to_uppercase(), rest)
    } else {
        // Unix 路径：--foo-bar → /foo/bar
        let rest = encoded
            .replace("--", "\x00")
            .replace('-', "/")
            .replace('\x00', "-");
        format!("/{}", rest.trim_start_matches('/'))
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    /// 编码后的目录名（用作 ID）
    pub id: String,
    /// 解码后的原始路径
    pub path: String,
    /// 会话数量
    pub session_count: usize,
    /// 最近会话时间（ISO 8601 字符串）
    pub last_session_at: Option<String>,
    /// 是否有项目级 CLAUDE.md
    pub has_project_claude_md: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveSession {
    pub pid: u32,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub cwd: String,
    #[serde(rename = "startedAt")]
    pub started_at: u64,
    pub kind: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversationMeta {
    pub id: String,
    pub project_id: String,
    /// 首条用户消息摘要
    pub first_message: Option<String>,
    pub message_count: usize,
    pub started_at: Option<String>,
    pub model: Option<String>,
}

/// 列出所有项目（扫描 ~/.claude/projects/）
#[tauri::command]
pub fn list_projects() -> Result<Vec<Project>, String> {
    let projects_dir = claude_dir().join("projects");
    let mut projects = Vec::new();
    let entries = match fs::read_dir(&projects_dir) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(e) => return Err(e.to_string()),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let encoded = entry.file_name().to_string_lossy().to_string();

        // 统计 .jsonl 会话文件，同时从 cwd 字段获取真实路径
        let mut session_count = 0usize;
        let mut last_modified: Option<std::time::SystemTime> = None;
        let mut real_path_from_cwd: Option<String> = None;

        if let Ok(sub_entries) = fs::read_dir(&path) {
            for sub in sub_entries.flatten() {
                let sub_path = sub.path();
                if sub_path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
                    session_count += 1;
                    if let Ok(meta) = sub_path.metadata() {
                        if let Ok(modified) = meta.modified() {
                            match last_modified {
                                None => last_modified = Some(modified),
                                Some(prev) if modified > prev => last_modified = Some(modified),
                                _ => {}
                            }
                        }
                    }
                    // 从第一个找到的 cwd 字段读取真实路径
                    if real_path_from_cwd.is_none() {
                        if let Ok(content) = fs::read_to_string(&sub_path) {
                            for line in content.lines() {
                                if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                                    if let Some(cwd) = v.get("cwd").and_then(|c| c.as_str()) {
                                        real_path_from_cwd = Some(cwd.to_string());
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // cwd 优先，fallback 到编码解码
        let decoded_path = real_path_from_cwd.unwrap_or_else(|| decode_project_path(&encoded));

        // 转换时间为 ISO 字符串
        let last_session_at = last_modified.map(|t| {
            let dur = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
            let secs = dur.as_secs() as i64;
            chrono::DateTime::from_timestamp(secs, 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default()
        });

        // 检查项目级 CLAUDE.md
        let project_real_path = PathBuf::from(&decoded_path);
        let has_project_claude_md = project_real_path.join("CLAUDE.md").exists();

        projects.push(Project {
            id: encoded,
            path: decoded_path,
            session_count,
            last_session_at,
            has_project_claude_md,
        });
    }

    // 按最近会话时间降序排列
    projects.sort_by(|a, b| b.last_session_at.cmp(&a.last_session_at));
    Ok(projects)
}

/// 获取当前活跃会话（读 ~/.claude/sessions/*.json，过滤已退出的进程）
#[tauri::command]
pub fn get_active_sessions() -> Result<Vec<ActiveSession>, String> {
    let sessions_dir = claude_dir().join("sessions");
    if !sessions_dir.exists() {
        return Ok(vec![]);
    }

    let sys = sysinfo::System::new_all();
    // pid → 最新的会话（/clear 后同一进程会产生新 session 文件，只保留最新的）
    let mut pid_map: std::collections::HashMap<u32, ActiveSession> = std::collections::HashMap::new();
    let entries = fs::read_dir(&sessions_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(session) = serde_json::from_str::<ActiveSession>(&content) {
                // 检查 PID 对应的进程是否仍在运行
                let pid = sysinfo::Pid::from(session.pid as usize);
                if sys.process(pid).is_some() {
                    // 同一 PID 只保留 startedAt 最新的会话
                    let entry = pid_map.entry(session.pid).or_insert_with(|| session.clone());
                    if session.started_at > entry.started_at {
                        *entry = session;
                    }
                }
            }
        }
    }

    let sessions: Vec<ActiveSession> = pid_map.into_values().collect();
    Ok(sessions)
}

/// 列出某项目下所有会话元信息
#[tauri::command]
pub fn list_sessions(project_id: String) -> Result<Vec<ConversationMeta>, String> {
    let project_dir = claude_dir().join("projects").join(&project_id);
    if !project_dir.exists() {
        return Err(format!("项目目录不存在: {}", project_id));
    }

    let mut metas = Vec::new();
    let entries = fs::read_dir(&project_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }
        let session_id = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        // 流式读取，提取元信息后早退（message_count 需要计所有行）
        let file = match fs::File::open(&path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let mut first_message: Option<String> = None;
        let mut message_count = 0usize;
        let mut started_at: Option<String> = None;
        let mut model: Option<String> = None;
        // 是否已收集到所有需要的元信息（不含 message_count，因需遍历全文）
        let mut meta_done = false;

        for line in BufReader::new(file).lines().flatten() {
            if line.trim().is_empty() {
                continue;
            }
            if let Ok(record) = serde_json::from_str::<serde_json::Value>(&line) {
                message_count += 1;

                if !meta_done {
                    if started_at.is_none() {
                        started_at = record["timestamp"].as_str().map(|s| s.to_string());
                    }
                    if first_message.is_none() && record["type"] == "user" {
                        let content_val = &record["message"]["content"];
                        // 提取文本内容（支持字符串或数组格式）
                        let extracted = if let Some(text) = content_val.as_str() {
                            Some(text.to_string())
                        } else if let Some(arr) = content_val.as_array() {
                            arr.iter().find_map(|block| {
                                if block["type"] == "text" {
                                    block["text"].as_str().map(|t| t.to_string())
                                } else {
                                    None
                                }
                            })
                        } else {
                            None
                        };
                        // 跳过系统注入的 caveat 消息（如 <local-command-caveat> 等）
                        if let Some(text) = extracted {
                            let trimmed = text.trim_start();
                            if !trimmed.starts_with('<') {
                                first_message = Some(trimmed.chars().take(80).collect());
                            }
                        }
                    }
                    if model.is_none() && record["type"] == "assistant" {
                        model = record["message"]["model"].as_str().map(|s| s.to_string());
                    }
                    if started_at.is_some() && first_message.is_some() && model.is_some() {
                        meta_done = true;
                    }
                }
            }
        }

        metas.push(ConversationMeta {
            id: session_id,
            project_id: project_id.clone(),
            first_message,
            message_count,
            started_at,
            model,
        });
    }

    // 按时间降序
    metas.sort_by(|a, b| b.started_at.cmp(&a.started_at));
    Ok(metas)
}

/// 读取完整会话内容（返回原始 JSONL 行数组）
#[tauri::command]
pub fn read_conversation(
    project_id: String,
    session_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    let file_path = claude_dir()
        .join("projects")
        .join(&project_id)
        .join(format!("{}.jsonl", session_id));

    let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let records: Vec<serde_json::Value> = content
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect();

    Ok(records)
}
