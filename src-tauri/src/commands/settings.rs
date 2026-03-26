use serde::{Deserialize, Serialize};
use std::fs;
use super::claude_dir;

/// settings.json 顶层结构
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

/// 读取全局 settings.json
#[tauri::command]
pub fn read_settings() -> Result<serde_json::Value, String> {
    let path = claude_dir().join("settings.json");
    if !path.exists() {
        return Ok(serde_json::Value::Object(serde_json::Map::new()));
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

/// 写入全局 settings.json（先备份）
#[tauri::command]
pub fn write_settings(settings: serde_json::Value) -> Result<(), String> {
    let path = claude_dir().join("settings.json");

    // 写入前备份
    if path.exists() {
        let backup_dir = claude_dir().join("backups");
        fs::create_dir_all(&backup_dir).ok();
        let timestamp = chrono::Utc::now().format("%Y%m%d%H%M%S");
        let backup_path = backup_dir.join(format!("settings.{}.json.bak", timestamp));
        fs::copy(&path, &backup_path).ok();
    }

    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}
