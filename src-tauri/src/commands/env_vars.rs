use std::collections::HashMap;

/// 读取指定的环境变量，返回 name → value 的映射（不存在则不包含该 key）
#[tauri::command]
pub fn get_env_vars(names: Vec<String>) -> HashMap<String, String> {
    names
        .into_iter()
        .filter_map(|name| std::env::var(&name).ok().map(|val| (name, val)))
        .collect()
}
