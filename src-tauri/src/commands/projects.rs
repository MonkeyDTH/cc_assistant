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

/// 激活指定 PID 会话所在的终端窗口（仅 Windows）
///
/// 三优先级查找：
///   1. 标题匹配：PID 在祖先链中 AND 窗口标题包含项目目录名（cwd 末段）
///   2. 精确匹配：PID 在非系统祖先链中的任意可见窗口
///   3. 同名回退：祖先链中出现过的进程名 → 同名进程的可见窗口
#[tauri::command]
pub fn activate_session_window(pid: u32, cwd: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
        use windows::Win32::UI::WindowsAndMessaging::{
            BringWindowToTop, EnumWindows, GetWindowTextW, GetWindowThreadProcessId,
            IsIconic, IsWindowVisible, SetForegroundWindow, ShowWindow, SW_RESTORE,
        };

        let sys = sysinfo::System::new_all();

        // 从 cwd 提取项目目录名，用于匹配窗口标题（如 "cc_assistant"）
        let project_name = std::path::Path::new(&cwd)
            .file_name()
            .map(|n| n.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        // ── 1. 构建祖先链（无深度上限）──────────────────────────────────────
        let mut ancestor_pids: Vec<u32> = vec![pid];
        let mut ancestor_exe_names: Vec<String> = Vec::new();
        let mut current = pid;
        loop {
            let sp = sysinfo::Pid::from(current as usize);
            match sys.process(sp) {
                Some(proc) => {
                    ancestor_exe_names.push(
                        proc.name().to_string_lossy().to_lowercase().to_owned(),
                    );
                    match proc.parent() {
                        Some(parent_pid) => {
                            let parent_u32 = usize::from(parent_pid) as u32;
                            if parent_u32 == 0 || ancestor_pids.len() > 50 {
                                break;
                            }
                            ancestor_pids.push(parent_u32);
                            current = parent_u32;
                        }
                        None => break,
                    }
                }
                None => break,
            }
        }

        // ── 2. 区分应用进程和系统进程 ─────────────────────────────────────
        const SYSTEM_EXES: &[&str] = &[
            "explorer.exe", "svchost.exe", "lsass.exe", "services.exe",
            "winlogon.exe", "wininit.exe", "csrss.exe", "smss.exe",
            "dllhost.exe", "system", "registry",
        ];

        let app_ancestor_set: std::collections::HashSet<u32> = ancestor_pids
            .iter()
            .copied()
            .zip(ancestor_exe_names.iter())
            .filter(|(_, name)| !SYSTEM_EXES.contains(&name.as_str()))
            .map(|(pid, _)| pid)
            .collect();

        let non_system_names: std::collections::HashSet<String> = ancestor_exe_names
            .iter()
            .filter(|n| !SYSTEM_EXES.contains(&n.as_str()))
            .cloned()
            .collect();

        let ancestor_pid_set: std::collections::HashSet<u32> =
            ancestor_pids.iter().copied().collect();
        let fallback_pids: std::collections::HashSet<u32> = sys
            .processes()
            .iter()
            .filter_map(|(p, proc)| {
                let name = proc.name().to_string_lossy().to_lowercase();
                let p_u32 = usize::from(*p) as u32;
                if non_system_names.contains(&name) && !ancestor_pid_set.contains(&p_u32) {
                    Some(p_u32)
                } else {
                    None
                }
            })
            .collect();

        // ── 3. EnumWindows：三优先级收集候选窗口 ────────────────────────────
        struct FindData {
            app_ancestors: std::collections::HashSet<u32>,
            fallback_pids: std::collections::HashSet<u32>,
            project_name: String, // 用于标题匹配的项目名
            title_hwnd: HWND,    // 优先级1：标题含项目名
            exact_hwnd: HWND,    // 优先级2：祖先进程的任意窗口
            fallback_hwnd: HWND, // 优先级3：同名进程的窗口
        }

        unsafe extern "system" fn enum_cb(hwnd: HWND, lparam: LPARAM) -> BOOL {
            let d = &mut *(lparam.0 as *mut FindData);
            if !IsWindowVisible(hwnd).as_bool() {
                return BOOL(1);
            }
            let mut wpid: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut wpid));

            let in_ancestors = d.app_ancestors.contains(&wpid);
            let in_fallback = !in_ancestors && d.fallback_pids.contains(&wpid);

            if in_ancestors || in_fallback {
                // 读取窗口标题
                let mut buf = [0u16; 512];
                let len = GetWindowTextW(hwnd, &mut buf);
                let title = String::from_utf16_lossy(&buf[..len as usize]).to_lowercase();
                let title_matches = !d.project_name.is_empty() && title.contains(d.project_name.as_str());

                if in_ancestors && title_matches && d.title_hwnd.0.is_null() {
                    d.title_hwnd = hwnd;
                } else if in_ancestors && d.exact_hwnd.0.is_null() {
                    d.exact_hwnd = hwnd;
                } else if in_fallback && title_matches && d.title_hwnd.0.is_null() {
                    d.title_hwnd = hwnd;
                } else if in_fallback && d.fallback_hwnd.0.is_null() {
                    d.fallback_hwnd = hwnd;
                }

                // 找到最高优先级即可停止
                if !d.title_hwnd.0.is_null() {
                    return BOOL(0);
                }
            }
            BOOL(1)
        }

        let mut find_data = FindData {
            app_ancestors: app_ancestor_set,
            fallback_pids,
            project_name,
            title_hwnd: HWND(std::ptr::null_mut()),
            exact_hwnd: HWND(std::ptr::null_mut()),
            fallback_hwnd: HWND(std::ptr::null_mut()),
        };

        unsafe {
            let _ = EnumWindows(
                Some(enum_cb),
                LPARAM(&mut find_data as *mut FindData as isize),
            );
        }

        let hwnd = if !find_data.title_hwnd.0.is_null() {
            find_data.title_hwnd
        } else if !find_data.exact_hwnd.0.is_null() {
            find_data.exact_hwnd
        } else if !find_data.fallback_hwnd.0.is_null() {
            find_data.fallback_hwnd
        } else {
            return Err("未找到该会话的终端窗口".to_string());
        };

        unsafe {
            if IsIconic(hwnd).as_bool() {
                let _ = ShowWindow(hwnd, SW_RESTORE);
            }
            let _ = BringWindowToTop(hwnd);
            let _ = SetForegroundWindow(hwnd);
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (pid, cwd);
        Err("仅支持 Windows 平台".to_string())
    }
}

/// 在新终端窗口中恢复指定会话
///
/// 优先使用 Windows Terminal（wt），回退到 PowerShell 新窗口。
/// 执行：cd <project_path> && claude -r <session_id>
#[tauri::command]
pub fn resume_session(project_path: String, session_id: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NEW_CONSOLE: u32 = 0x00000010;

        // 注意：不能在传给 wt 的命令中使用 `;`，
        // 因为 Windows Terminal 会把 `;` 解析为多标签分隔符。
        // wt 的 `-d` 已经设置起始目录，只需直接执行 claude -r。
        let claude_cmd = format!("claude -r {}", session_id);

        // 优先尝试 Windows Terminal（-d 设置工作目录，无需 Set-Location）
        let wt_ok = std::process::Command::new("wt")
            .args([
                "-d", &project_path,
                "--", "powershell", "-NoExit", "-Command", &claude_cmd,
            ])
            .spawn()
            .is_ok();

        if !wt_ok {
            // 回退：直接新建 PowerShell 窗口，通过 current_dir 设置工作目录
            std::process::Command::new("powershell")
                .args(["-NoExit", "-Command", &claude_cmd])
                .current_dir(&project_path)
                .creation_flags(CREATE_NEW_CONSOLE)
                .spawn()
                .map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        // macOS/Linux：用 open -a Terminal 或 gnome-terminal
        let sh_cmd = format!(
            "cd '{}' && claude -r {}",
            project_path.replace('\'', "'\\''"),
            session_id
        );

        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .args(["-a", "Terminal", &project_path])
                .spawn()
                .map_err(|e| e.to_string())?;
            // macOS 无法直接注入命令到 Terminal.app，先 cd 到目录后用户手动执行
            // 更佳方案可使用 osascript，此处保持简单
            let _ = sh_cmd;
        }

        #[cfg(target_os = "linux")]
        {
            // 依次尝试常见终端
            let terminals = ["gnome-terminal", "xterm", "konsole"];
            let mut launched = false;
            for term in terminals {
                let result = if term == "gnome-terminal" {
                    std::process::Command::new(term)
                        .args(["--", "bash", "-c", &format!("{}; exec bash", sh_cmd)])
                        .spawn()
                } else {
                    std::process::Command::new(term)
                        .args(["-e", &format!("bash -c '{}; exec bash'", sh_cmd)])
                        .spawn()
                };
                if result.is_ok() {
                    launched = true;
                    break;
                }
            }
            if !launched {
                return Err("未找到可用的终端模拟器".to_string());
            }
        }

        Ok(())
    }
}

/// 删除指定会话（删除对应的 .jsonl 文件）
#[tauri::command]
pub fn delete_session(project_id: String, session_id: String) -> Result<(), String> {
    let file_path = claude_dir()
        .join("projects")
        .join(&project_id)
        .join(format!("{}.jsonl", session_id));

    match fs::remove_file(&file_path) {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
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
