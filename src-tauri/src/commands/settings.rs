use super::{read_settings_json, write_settings_json};

#[tauri::command]
pub fn read_settings() -> Result<serde_json::Value, String> {
    read_settings_json()
}

#[tauri::command]
pub fn write_settings(settings: serde_json::Value) -> Result<(), String> {
    write_settings_json(settings)
}
