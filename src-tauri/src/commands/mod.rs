pub mod projects;
pub mod settings;
pub mod prompt;
pub mod skills;
pub mod plugins;
pub mod hooks;

use std::path::PathBuf;
use std::fs;

pub fn claude_dir() -> PathBuf {
    dirs::home_dir()
        .expect("无法获取 home 目录")
        .join(".claude")
}

pub fn settings_path() -> PathBuf {
    claude_dir().join("settings.json")
}

/// 读取 settings.json，文件不存在时返回空对象。
pub fn read_settings_json() -> Result<serde_json::Value, String> {
    match fs::read_to_string(settings_path()) {
        Ok(content) => serde_json::from_str(&content).map_err(|e| e.to_string()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            Ok(serde_json::Value::Object(serde_json::Map::new()))
        }
        Err(e) => Err(e.to_string()),
    }
}

/// 写入 settings.json（写前备份，备份文件名含毫秒避免同秒覆盖）。
pub fn write_settings_json(value: serde_json::Value) -> Result<(), String> {
    let path = settings_path();
    let backup_dir = claude_dir().join("backups");
    fs::create_dir_all(&backup_dir).ok();
    let ts = chrono::Utc::now().format("%Y%m%d%H%M%S%3f");
    let backup = backup_dir.join(format!("settings.{}.json.bak", ts));
    fs::copy(&path, &backup).ok();
    let content = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}
