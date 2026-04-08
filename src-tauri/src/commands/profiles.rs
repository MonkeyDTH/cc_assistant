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
    /// 额外环境变量，激活时直接写入 settings.json env；值为空字符串则删除该 key
    #[serde(rename = "extraEnvVars", default, skip_serializing_if = "std::collections::HashMap::is_empty")]
    pub extra_env_vars: std::collections::HashMap<String, String>,
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

/// 非空则写入 env，为空则删除（让 Claude Code 回退到默认值）。
fn set_or_remove_env(env: &mut serde_json::Map<String, serde_json::Value>, key: &str, value: &str) {
    if value.is_empty() {
        env.remove(key);
    } else {
        env.insert(key.to_string(), serde_json::Value::String(value.to_string()));
    }
}

/// 激活指定 profile：更新 activeProfileId，并同步写入 settings.json 的 env 字段。
#[tauri::command]
pub fn activate_profile(profile_id: String) -> Result<(), String> {
    let mut config = match fs::read_to_string(profiles_path()) {
        Ok(content) => serde_json::from_str::<ProfilesConfig>(&content).map_err(|e| e.to_string())?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Err("profiles 配置文件不存在".to_string());
        }
        Err(e) => return Err(e.to_string()),
    };

    // 单次遍历：同时收集旧 profile 的 extraEnvVars keys 和新 profile 的字段
    let prev_id = config.active_profile_id.clone();
    let mut prev_extra_env_keys: Vec<String> = Vec::new();
    let mut new_data: Option<(String, String, ProfileModels, std::collections::HashMap<String, String>)> = None;

    for p in &config.profiles {
        if prev_id.as_deref() == Some(p.id.as_str()) {
            prev_extra_env_keys = p.extra_env_vars.keys().cloned().collect();
        }
        if p.id == profile_id {
            new_data = Some((p.api_key.clone(), p.base_url.clone(), p.models.clone(), p.extra_env_vars.clone()));
        }
    }

    let (api_key, base_url, models, extra_env_vars) = new_data
        .ok_or_else(|| format!("找不到 profile: {}", profile_id))?;

    config.active_profile_id = Some(profile_id);
    let profiles_content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(profiles_path(), profiles_content).map_err(|e| e.to_string())?;

    let mut settings = read_settings_json()?;
    {
        let settings_obj = settings.as_object_mut().ok_or("settings.json 格式错误")?;
        if !settings_obj.contains_key("env") {
            settings_obj.insert("env".to_string(), serde_json::Value::Object(serde_json::Map::new()));
        }
        let env = settings_obj.get_mut("env").unwrap().as_object_mut().ok_or("env 字段格式错误")?;

        // api_key 为空时显式写入空字符串，覆盖系统环境变量
        env.insert("ANTHROPIC_API_KEY".to_string(), serde_json::Value::String(api_key));

        set_or_remove_env(env, "ANTHROPIC_BASE_URL", &base_url);
        set_or_remove_env(env, "ANTHROPIC_DEFAULT_OPUS_MODEL",   &models.opus);
        set_or_remove_env(env, "ANTHROPIC_DEFAULT_SONNET_MODEL", &models.sonnet);
        set_or_remove_env(env, "ANTHROPIC_DEFAULT_HAIKU_MODEL",  &models.haiku);

        // 清除旧 profile 遗留的 extraEnvVars key，再写入新的
        for k in &prev_extra_env_keys {
            env.remove(k.as_str());
        }
        for (k, v) in &extra_env_vars {
            set_or_remove_env(env, k, v);
        }
    }
    write_settings_json(settings)
}
