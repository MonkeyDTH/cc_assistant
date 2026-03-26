use serde::{Deserialize, Serialize};
use super::{read_settings_json, write_settings_json};

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Settings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Permissions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hooks: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(rename = "enabledPlugins", skip_serializing_if = "Option::is_none")]
    pub enabled_plugins: Option<serde_json::Value>,
    #[serde(rename = "statusLine", skip_serializing_if = "Option::is_none")]
    pub status_line: Option<serde_json::Value>,
    /// 保留其他未知字段
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Permissions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deny: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ask: Option<Vec<String>>,
}

#[tauri::command]
pub fn read_settings() -> Result<serde_json::Value, String> {
    read_settings_json()
}

#[tauri::command]
pub fn write_settings(settings: serde_json::Value) -> Result<(), String> {
    write_settings_json(settings)
}
