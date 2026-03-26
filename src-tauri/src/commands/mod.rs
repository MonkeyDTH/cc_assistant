pub mod projects;
pub mod settings;
pub mod prompt;
pub mod skills;
pub mod plugins;
pub mod hooks;

use std::path::PathBuf;

/// 获取 ~/.claude 目录路径
pub fn claude_dir() -> PathBuf {
    dirs::home_dir()
        .expect("无法获取 home 目录")
        .join(".claude")
}
