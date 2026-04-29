use std::path::PathBuf;
use std::process::Command;
use tauri::command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// 去掉 ANSI 转义码（ESC [ ... m 等序列）
fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            // 跳过 ESC [ ... 直到遇到字母
            if chars.peek() == Some(&'[') {
                chars.next();
                for ch in chars.by_ref() {
                    if ch.is_ascii_alphabetic() { break; }
                }
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// 调用 codeburn export -f json，将输出文件读取后返回 JSON 字符串，并删除临时文件。
/// 必须用 async + spawn_blocking：codeburn 进程动辄数秒，
/// 同步命令会占用 Tauri 主线程，阻塞所有 IPC（其他页面也切不动）。
#[command]
pub async fn get_codeburn_data() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(get_codeburn_data_blocking)
        .await
        .map_err(|e| format!("codeburn 任务调度失败: {e}"))?
}

fn get_codeburn_data_blocking() -> Result<String, String> {
    let tmp_dir = std::env::temp_dir();

    // Windows 上 npm 全局命令是 .cmd 文件，必须通过 cmd /c 调用；
    // CREATE_NO_WINDOW 防止弹出黑色控制台窗口。
    // Tauri 作为 GUI 进程只继承系统 PATH，需手动合并用户 PATH 才能找到 npm 全局工具。
    #[cfg(target_os = "windows")]
    let full_path = {
        let user_path = Command::new("pwsh")
            .args(["-NoProfile", "-NonInteractive", "-Command",
                   "[Environment]::GetEnvironmentVariable('PATH','User')"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .unwrap_or_default();
        let user_path = user_path.trim();
        if user_path.is_empty() {
            std::env::var("PATH").unwrap_or_default()
        } else {
            format!("{};{}", std::env::var("PATH").unwrap_or_default(), user_path)
        }
    };

    #[cfg(target_os = "windows")]
    let output = Command::new("cmd")
        .args(["/c", "codeburn", "export", "-f", "json", "--provider", "claude"])
        .current_dir(&tmp_dir)
        .env("PATH", &full_path)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("启动 codeburn 失败: {e}"))?;

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("codeburn")
        .args(["export", "-f", "json", "--provider", "claude"])
        .current_dir(&tmp_dir)
        .output()
        .map_err(|e| format!("启动 codeburn 失败: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!("codeburn 执行失败:\nstdout: {stdout}\nstderr: {stderr}"));
    }

    let raw_stdout = String::from_utf8_lossy(&output.stdout);
    let stdout = strip_ansi(&raw_stdout);

    let file_path = stdout
        .lines()
        .find_map(|line| {
            let trimmed = line.trim();
            if trimmed.contains("Exported") && trimmed.contains("to:") {
                trimmed.split("to:").nth(1).map(|s| s.trim().to_string())
            } else {
                None
            }
        })
        .ok_or_else(|| format!("无法从 codeburn 输出解析文件路径，原始输出:\n{stdout}"))?;

    if !std::path::Path::new(&file_path).exists() {
        return Err(format!("codeburn 输出的文件路径不存在: {file_path}"));
    }

    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("读取导出文件失败 ({file_path}): {e}"))?;

    let _ = std::fs::remove_file(&file_path);

    Ok(content)
}

// ── 用量缓存：~/.cc-assistant/usage-cache.json ──
// 内容由前端组装，形如 { savedAt: "2026-04-29T12:34:56.000Z", data: <CodburnData> }
// 后端只负责字符串读写，不解析结构

fn usage_cache_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".cc-assistant").join("usage-cache.json"))
}

#[command]
pub fn read_usage_cache() -> Option<String> {
    let path = usage_cache_path()?;
    std::fs::read_to_string(&path).ok()
}

#[command]
pub fn write_usage_cache(content: String) -> Result<(), String> {
    let path = usage_cache_path().ok_or_else(|| "无法获取 home 目录".to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[command]
pub fn clear_usage_cache() -> Result<(), String> {
    if let Some(path) = usage_cache_path() {
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
