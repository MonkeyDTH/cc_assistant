use super::{read_settings_json, write_settings_json};

#[tauri::command]
pub fn read_hooks() -> Result<serde_json::Value, String> {
    Ok(read_settings_json()?["hooks"].clone())
}

#[tauri::command]
pub fn write_hooks(hooks: serde_json::Value) -> Result<(), String> {
    let mut settings = read_settings_json()?;
    settings["hooks"] = hooks;
    write_settings_json(settings)
}
