use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

/// CC Assistant 自身的应用偏好设置（与 Claude Code 的 settings.json 无关）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// 关闭窗口时最小化到系统托盘，而不是退出
    #[serde(default)]
    pub minimize_to_tray: bool,
    /// 在仪表盘和会话记录中隐藏的项目 ID 列表
    #[serde(default)]
    pub hidden_project_ids: Vec<String>,
    /// Hooks 页面：仅显示已配置的 hook 事件
    #[serde(default)]
    pub hooks_only_configured: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            minimize_to_tray: false,
            hidden_project_ids: Vec::new(),
            hooks_only_configured: false,
        }
    }
}

/// Tauri managed state，供关闭事件处理器同步读取
pub struct AppConfigState(pub Mutex<AppConfig>);

fn config_path() -> PathBuf {
    dirs::home_dir()
        .expect("无法获取 home 目录")
        .join(".cc-assistant")
        .join("config.json")
}

/// 从磁盘加载配置，不存在则返回默认值
pub fn load_app_config() -> AppConfig {
    let path = config_path();
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

fn save_to_disk(config: &AppConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_app_config(app: tauri::AppHandle) -> AppConfig {
    let state = app.state::<AppConfigState>();
    let config = state.0.lock().unwrap().clone();
    config
}

#[tauri::command]
pub fn write_app_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    // 同步更新 managed state（关闭事件处理器会立即看到新值）
    {
        let state = app.state::<AppConfigState>();
        *state.0.lock().unwrap() = config.clone();
    }
    save_to_disk(&config)
}
