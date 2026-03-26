use std::fs;
use super::claude_dir;

/// 读取 settings.json 中的 hooks 字段
#[tauri::command]
pub fn read_hooks() -> Result<serde_json::Value, String> {
    let path = claude_dir().join("settings.json");
    if !path.exists() {
        return Ok(serde_json::Value::Object(serde_json::Map::new()));
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let settings: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(settings["hooks"].clone())
}

/// 写入 settings.json 中的 hooks 字段（其他字段保留）
#[tauri::command]
pub fn write_hooks(hooks: serde_json::Value) -> Result<(), String> {
    let path = claude_dir().join("settings.json");

    // 备份
    if path.exists() {
        let backup_dir = claude_dir().join("backups");
        fs::create_dir_all(&backup_dir).ok();
        let ts = chrono::Utc::now().format("%Y%m%d%H%M%S");
        let backup = backup_dir.join(format!("settings.hooks.{}.json.bak", ts));
        fs::copy(&path, &backup).ok();
    }

    let content = fs::read_to_string(&path).unwrap_or_else(|_| "{}".to_string());
    let mut settings: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    settings["hooks"] = hooks;

    let new_content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, new_content).map_err(|e| e.to_string())
}
