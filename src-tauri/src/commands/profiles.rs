use serde::{Deserialize, Serialize};
use std::fs;
use super::{claude_dir, read_settings_json, write_settings_json};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileModels {
    pub opus: String,
    pub sonnet: String,
    pub haiku: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiProfile {
    pub id: String,
    pub name: String,
    #[serde(rename = "apiKey")]
    pub api_key: String,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    pub models: ProfileModels,
    /// 自定义请求头，激活时序列化为 JSON 写入 ANTHROPIC_CUSTOM_HEADERS
    #[serde(rename = "customHeaders", default, skip_serializing_if = "std::collections::HashMap::is_empty")]
    pub custom_headers: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfilesConfig {
    #[serde(rename = "activeProfileId")]
    pub active_profile_id: Option<String>,
    pub profiles: Vec<ApiProfile>,
}

fn profiles_path() -> std::path::PathBuf {
    claude_dir().join("cc_assistant_profiles.json")
}

/// 读取 ~/.claude/cc_assistant_profiles.json，文件不存在时返回空配置。
#[tauri::command]
pub fn read_profiles() -> Result<ProfilesConfig, String> {
    match fs::read_to_string(profiles_path()) {
        Ok(content) => serde_json::from_str(&content).map_err(|e| e.to_string()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(ProfilesConfig {
            active_profile_id: None,
            profiles: vec![],
        }),
        Err(e) => Err(e.to_string()),
    }
}

/// 写入 profiles 配置文件（不修改 settings.json）。
#[tauri::command]
pub fn write_profiles(config: ProfilesConfig) -> Result<(), String> {
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(profiles_path(), content).map_err(|e| e.to_string())
}

/// 激活指定 profile：更新 activeProfileId，并同步写入 settings.json 的 env 字段。
#[tauri::command]
pub fn activate_profile(profile_id: String) -> Result<(), String> {
    // 读取现有 profiles
    let mut config = match fs::read_to_string(profiles_path()) {
        Ok(content) => serde_json::from_str::<ProfilesConfig>(&content).map_err(|e| e.to_string())?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Err("profiles 配置文件不存在".to_string());
        }
        Err(e) => return Err(e.to_string()),
    };

    // 找到目标 profile（提前克隆所需字段）
    let (api_key, base_url, custom_headers) = config
        .profiles
        .iter()
        .find(|p| p.id == profile_id)
        .map(|p| (p.api_key.clone(), p.base_url.clone(), p.custom_headers.clone()))
        .ok_or_else(|| format!("找不到 profile: {}", profile_id))?;

    // 更新 activeProfileId 并写回 profiles 文件
    config.active_profile_id = Some(profile_id);
    let profiles_content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(profiles_path(), profiles_content).map_err(|e| e.to_string())?;

    // 同步更新 settings.json 的 env 字段
    let mut settings = read_settings_json()?;
    {
        let settings_obj = settings.as_object_mut().ok_or("settings.json 格式错误")?;
        if !settings_obj.contains_key("env") {
            settings_obj.insert(
                "env".to_string(),
                serde_json::Value::Object(serde_json::Map::new()),
            );
        }
        let env = settings_obj
            .get_mut("env")
            .unwrap()
            .as_object_mut()
            .ok_or("env 字段格式错误")?;

        if api_key.is_empty() {
            env.remove("ANTHROPIC_API_KEY");
        } else {
            env.insert(
                "ANTHROPIC_API_KEY".to_string(),
                serde_json::Value::String(api_key),
            );
        }

        if base_url.is_empty() {
            env.remove("ANTHROPIC_BASE_URL");
        } else {
            env.insert(
                "ANTHROPIC_BASE_URL".to_string(),
                serde_json::Value::String(base_url),
            );
        }

        if custom_headers.is_empty() {
            env.remove("ANTHROPIC_CUSTOM_HEADERS");
        } else {
            let headers_json = serde_json::to_string(&custom_headers)
                .map_err(|e| e.to_string())?;
            env.insert(
                "ANTHROPIC_CUSTOM_HEADERS".to_string(),
                serde_json::Value::String(headers_json),
            );
        }
    }
    write_settings_json(settings)
}
