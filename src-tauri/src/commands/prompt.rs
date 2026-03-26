use std::fs;
use std::path::PathBuf;
use super::claude_dir;

/// 读取全局 ~/.claude/CLAUDE.md
#[tauri::command]
pub fn read_global_claude_md() -> Result<String, String> {
    let path = claude_dir().join("CLAUDE.md");
    if !path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// 写入全局 ~/.claude/CLAUDE.md
#[tauri::command]
pub fn write_global_claude_md(content: String) -> Result<(), String> {
    let path = claude_dir().join("CLAUDE.md");
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// 读取项目级 <project_path>/.claude/CLAUDE.md
#[tauri::command]
pub fn read_project_claude_md(project_path: String) -> Result<String, String> {
    let path = PathBuf::from(&project_path)
        .join(".claude")
        .join("CLAUDE.md");
    if !path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// 写入项目级 CLAUDE.md（自动创建 .claude/ 目录）
#[tauri::command]
pub fn write_project_claude_md(project_path: String, content: String) -> Result<(), String> {
    let claude_dir = PathBuf::from(&project_path).join(".claude");
    fs::create_dir_all(&claude_dir).map_err(|e| e.to_string())?;
    let path = claude_dir.join("CLAUDE.md");
    fs::write(&path, content).map_err(|e| e.to_string())
}
