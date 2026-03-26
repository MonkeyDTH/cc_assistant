use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use super::claude_dir;

/// 解码项目目录名为原始路径
/// 规则：`--` → `\`（Windows）或 `/`（Unix），同时还原盘符冒号
fn decode_project_path(encoded: &str) -> String {
    // 示例：D--Projects-Personal-cc_assistant → D:\Projects\Personal\cc_assistant
    // 先把 -- 替换为临时占位，再把单个 - 还原为 /
    // 实际上 Claude Code 用 -- 替换路径分隔符，单个 - 是路径中本来的连字符
    // 正确规则：把第一段（盘符）的 -- 变成 :\，其余 -- 变成 \
    let parts: Vec<&str> = encoded.splitn(3, "--").collect();
    if parts.len() >= 2 && parts[0].len() == 1 {
        // Windows 路径，如 D--Projects-...
        let rest = encoded[3..].replace("--", "\\");
        format!("{}:\\{}", parts[0].to_uppercase(), rest)
    } else {
        // Unix 路径
        format!("/{}", encoded.replace("--", "/"))
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

#[derive(Debug, Serialize, Deserialize)]
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
    if !projects_dir.exists() {
        return Ok(vec![]);
    }

    let mut projects = Vec::new();
    let entries = fs::read_dir(&projects_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let encoded = entry.file_name().to_string_lossy().to_string();
        let decoded_path = decode_project_path(&encoded);

        // 统计 .jsonl 会话文件
        let mut session_count = 0usize;
        let mut last_modified: Option<std::time::SystemTime> = None;

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
                }
            }
        }

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
        let has_project_claude_md = project_real_path.join(".claude").join("CLAUDE.md").exists();

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

/// 获取当前活跃会话（读 ~/.claude/sessions/*.json）
#[tauri::command]
pub fn get_active_sessions() -> Result<Vec<ActiveSession>, String> {
    let sessions_dir = claude_dir().join("sessions");
    if !sessions_dir.exists() {
        return Ok(vec![]);
    }

    let mut sessions = Vec::new();
    let entries = fs::read_dir(&sessions_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(session) = serde_json::from_str::<ActiveSession>(&content) {
                sessions.push(session);
            }
        }
    }

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

        // 快速扫描前几行提取元信息
        let content = fs::read_to_string(&path).unwrap_or_default();
        let mut first_message: Option<String> = None;
        let mut message_count = 0usize;
        let mut started_at: Option<String> = None;
        let mut model: Option<String> = None;

        for line in content.lines() {
            if line.trim().is_empty() {
                continue;
            }
            if let Ok(record) = serde_json::from_str::<serde_json::Value>(line) {
                message_count += 1;

                // 获取第一条时间
                if started_at.is_none() {
                    started_at = record["timestamp"].as_str().map(|s| s.to_string());
                }

                // 找第一条用户消息
                if first_message.is_none() && record["type"] == "user" {
                    let content_val = &record["message"]["content"];
                    if let Some(text) = content_val.as_str() {
                        let preview = text.chars().take(80).collect::<String>();
                        first_message = Some(preview);
                    } else if let Some(arr) = content_val.as_array() {
                        for block in arr {
                            if block["type"] == "text" {
                                if let Some(text) = block["text"].as_str() {
                                    let preview = text.chars().take(80).collect::<String>();
                                    first_message = Some(preview);
                                    break;
                                }
                            }
                        }
                    }
                }

                // 找模型信息
                if model.is_none() && record["type"] == "assistant" {
                    model = record["message"]["model"].as_str().map(|s| s.to_string());
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
