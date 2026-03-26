use serde::{Deserialize, Serialize};
use std::fs;
use std::collections::HashMap;
use super::claude_dir;

#[derive(Debug, Serialize, Deserialize)]
pub struct MarketplaceSource {
    pub source: String,   // "github"
    pub repo: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Marketplace {
    pub id: String,
    pub source: MarketplaceSource,
    pub install_location: String,
    pub last_updated: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MarketplacePlugin {
    /// "name@marketplace_id"
    pub id: String,
    pub name: String,
    pub marketplace_id: String,
    pub version: Option<String>,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub keywords: Vec<String>,
    /// 是否已安装
    pub installed: bool,
    /// 安装的版本（已安装时有值）
    pub installed_version: Option<String>,
}

/// 列出已知市场源
#[tauri::command]
pub fn list_marketplaces() -> Result<Vec<Marketplace>, String> {
    let path = claude_dir().join("plugins").join("known_marketplaces.json");
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(e) => return Err(e.to_string()),
    };

    let raw: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let obj = raw.as_object().ok_or("known_marketplaces.json 格式错误")?;

    let mut result = Vec::new();
    for (id, val) in obj {
        let source_val = &val["source"]["source"];
        let repo = val["source"]["repo"].as_str().map(|s| s.to_string());
        result.push(Marketplace {
            id: id.clone(),
            source: MarketplaceSource {
                source: source_val.as_str().unwrap_or("github").to_string(),
                repo,
            },
            install_location: val["installLocation"].as_str().unwrap_or("").to_string(),
            last_updated: val["lastUpdated"].as_str().map(|s| s.to_string()),
        });
    }
    Ok(result)
}

/// 扫描本地缓存的 marketplace，列出所有可用插件
#[tauri::command]
pub fn list_marketplace_plugins() -> Result<Vec<MarketplacePlugin>, String> {
    let plugins_dir = claude_dir().join("plugins");
    let marketplaces_dir = plugins_dir.join("marketplaces");
    let installed_path = plugins_dir.join("installed_plugins.json");

    // 读取已安装插件集合（用于标记 installed 状态）
    let installed_map: HashMap<String, String> = fs::read_to_string(&installed_path)
        .ok()
        .and_then(|c| serde_json::from_str::<serde_json::Value>(&c).ok())
        .and_then(|v| v["plugins"].as_object().cloned())
        .map(|m| {
            m.into_iter()
                .filter_map(|(plugin_id, entries)| {
                    let version = entries.as_array()?
                        .first()?["version"].as_str()?
                        .to_string();
                    Some((plugin_id, version))
                })
                .collect()
        })
        .unwrap_or_default();

    let entries = match fs::read_dir(&marketplaces_dir) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(e) => return Err(e.to_string()),
    };

    let mut all_plugins = Vec::new();

    for marketplace_entry in entries.flatten() {
        let marketplace_path = marketplace_entry.path();
        if !marketplace_path.is_dir() { continue; }
        let marketplace_id = marketplace_entry.file_name().to_string_lossy().to_string();

        // 扫描两个插件目录：plugins/ 和 external_plugins/
        for subdir in &["plugins", "external_plugins"] {
            let plugin_root = marketplace_path.join(subdir);
            let plugin_entries = match fs::read_dir(&plugin_root) {
                Ok(e) => e,
                Err(_) => continue,
            };

            for plugin_entry in plugin_entries.flatten() {
                let plugin_path = plugin_entry.path();
                if !plugin_path.is_dir() { continue; }

                let plugin_json_path = plugin_path.join(".claude-plugin").join("plugin.json");
                let content = match fs::read_to_string(&plugin_json_path) {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                let pj: serde_json::Value = match serde_json::from_str(&content) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                let name = pj["name"].as_str().unwrap_or("").to_string();
                if name.is_empty() { continue; }

                let plugin_id = format!("{}@{}", name, marketplace_id);
                let installed_version = installed_map.get(&plugin_id).cloned();
                let installed = installed_version.is_some();

                let keywords: Vec<String> = pj["keywords"].as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                    .unwrap_or_default();

                all_plugins.push(MarketplacePlugin {
                    id: plugin_id,
                    name,
                    marketplace_id: marketplace_id.clone(),
                    version: pj["version"].as_str().map(|s| s.to_string()),
                    description: pj["description"].as_str().map(|s| s.to_string()),
                    homepage: pj["homepage"].as_str().map(|s| s.to_string()),
                    keywords,
                    installed,
                    installed_version,
                });
            }
        }
    }

    all_plugins.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(all_plugins)
}
