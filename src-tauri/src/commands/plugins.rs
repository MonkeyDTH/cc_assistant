use serde::{Deserialize, Serialize};
use std::fs;
use std::collections::HashMap;
use super::claude_dir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginInstallEntry {
    pub scope: String,
    #[serde(rename = "installPath")]
    pub install_path: String,
    pub version: String,
    #[serde(rename = "installedAt")]
    pub installed_at: String,
    #[serde(rename = "lastUpdated")]
    pub last_updated: String,
    #[serde(rename = "gitCommitSha")]
    pub git_commit_sha: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstalledPluginsFile {
    pub version: u32,
    pub plugins: HashMap<String, Vec<PluginInstallEntry>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PluginInfo {
    /// "name@marketplace" 形式的唯一 ID
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub installed_at: String,
    pub scope: String,
    /// 来自 settings.json enabledPlugins
    pub enabled: bool,
    pub install_path: String,
}

/// 读取并合并插件安装信息和启用状态
#[tauri::command]
pub fn list_plugins() -> Result<Vec<PluginInfo>, String> {
    let plugins_dir = claude_dir().join("plugins");
    let installed_path = plugins_dir.join("installed_plugins.json");
    let settings_path = claude_dir().join("settings.json");

    if !installed_path.exists() {
        return Ok(vec![]);
    }

    // 读取 installed_plugins.json
    let content = fs::read_to_string(&installed_path).map_err(|e| e.to_string())?;
    let installed: InstalledPluginsFile = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // 读取 settings.json 中的 enabledPlugins
    let enabled_plugins: HashMap<String, bool> = fs::read_to_string(&settings_path)
        .ok()
        .and_then(|c| serde_json::from_str::<serde_json::Value>(&c).ok())
        .and_then(|v| v["enabledPlugins"].as_object().cloned())
        .map(|m| m.into_iter().filter_map(|(k, v)| v.as_bool().map(|b| (k, b))).collect())
        .unwrap_or_default();

    let mut result = Vec::new();

    for (plugin_id, entries) in &installed.plugins {
        // 取最新版本条目
        let entry = entries.first().cloned().unwrap_or_else(|| PluginInstallEntry {
            scope: "user".into(),
            install_path: String::new(),
            version: "unknown".into(),
            installed_at: String::new(),
            last_updated: String::new(),
            git_commit_sha: None,
        });

        // 尝试读取 plugin.json 获取描述
        let plugin_json_path = std::path::Path::new(&entry.install_path)
            .join(".claude-plugin")
            .join("plugin.json");
        let (description, homepage) = if plugin_json_path.exists() {
            fs::read_to_string(&plugin_json_path)
                .ok()
                .and_then(|c| serde_json::from_str::<serde_json::Value>(&c).ok())
                .map(|v| {
                    let desc = v["description"].as_str().map(|s| s.to_string());
                    let hp = v["homepage"].as_str().map(|s| s.to_string());
                    (desc, hp)
                })
                .unwrap_or((None, None))
        } else {
            (None, None)
        };

        // 从 plugin_id 提取 name（格式：name@marketplace）
        let name = plugin_id.split('@').next().unwrap_or(plugin_id).to_string();
        let enabled = *enabled_plugins.get(plugin_id).unwrap_or(&false);

        result.push(PluginInfo {
            id: plugin_id.clone(),
            name,
            version: entry.version,
            description,
            homepage,
            installed_at: entry.installed_at,
            scope: entry.scope,
            enabled,
            install_path: entry.install_path,
        });
    }

    result.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(result)
}

/// 切换插件启用/禁用状态（写入 settings.json enabledPlugins）
#[tauri::command]
pub fn set_plugin_enabled(plugin_id: String, enabled: bool) -> Result<(), String> {
    let settings_path = claude_dir().join("settings.json");

    let content = fs::read_to_string(&settings_path).unwrap_or_else(|_| "{}".to_string());
    let mut settings: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // 确保 enabledPlugins 对象存在
    if !settings["enabledPlugins"].is_object() {
        settings["enabledPlugins"] = serde_json::Value::Object(serde_json::Map::new());
    }
    settings["enabledPlugins"][&plugin_id] = serde_json::Value::Bool(enabled);

    let new_content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, new_content).map_err(|e| e.to_string())
}
