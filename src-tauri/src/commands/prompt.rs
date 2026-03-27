use std::fs;
use std::path::PathBuf;
use super::claude_dir;

/// 读取全局 ~/.claude/CLAUDE.md
#[tauri::command]
pub fn read_global_claude_md() -> Result<String, String> {
    match fs::read_to_string(claude_dir().join("CLAUDE.md")) {
        Ok(s) => Ok(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

/// 写入全局 ~/.claude/CLAUDE.md
#[tauri::command]
pub fn write_global_claude_md(content: String) -> Result<(), String> {
    let path = claude_dir().join("CLAUDE.md");
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// 读取项目级 <project_path>/CLAUDE.md
#[tauri::command]
pub fn read_project_claude_md(project_path: String) -> Result<String, String> {
    let path = PathBuf::from(&project_path).join("CLAUDE.md");
    match fs::read_to_string(&path) {
        Ok(s) => Ok(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

/// 写入项目级 CLAUDE.md（项目根目录）
#[tauri::command]
pub fn write_project_claude_md(project_path: String, content: String) -> Result<(), String> {
    if project_path.is_empty() {
        return Err("project_path 为空，IPC 参数未正确传递".to_string());
    }
    let path = PathBuf::from(&project_path).join("CLAUDE.md");
    fs::write(&path, content).map_err(|e| format!("写入 {} 失败: {}", path.display(), e))
}
