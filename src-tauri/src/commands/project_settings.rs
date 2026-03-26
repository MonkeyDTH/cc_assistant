use std::fs;
use std::path::PathBuf;

/// 读取项目级 <project_path>/.claude/settings.json
#[tauri::command]
pub fn read_project_settings(project_path: String) -> Result<serde_json::Value, String> {
    let path = PathBuf::from(&project_path)
        .join(".claude")
        .join("settings.json");
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).map_err(|e| e.to_string()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            Ok(serde_json::Value::Object(serde_json::Map::new()))
        }
        Err(e) => Err(e.to_string()),
    }
}

/// 写入项目级 <project_path>/.claude/settings.json（自动创建 .claude/）
#[tauri::command]
pub fn write_project_settings(project_path: String, settings: serde_json::Value) -> Result<(), String> {
    let claude_dir = PathBuf::from(&project_path).join(".claude");
    fs::create_dir_all(&claude_dir).map_err(|e| e.to_string())?;
    let path = claude_dir.join("settings.json");
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}
