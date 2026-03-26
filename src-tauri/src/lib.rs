mod commands;

use commands::{projects, settings, prompt, skills, plugins, hooks};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // 项目/会话相关
            projects::list_projects,
            projects::list_sessions,
            projects::get_active_sessions,
            projects::read_conversation,
            // 全局设置
            settings::read_settings,
            settings::write_settings,
            // Prompt / CLAUDE.md
            prompt::read_global_claude_md,
            prompt::write_global_claude_md,
            prompt::read_project_claude_md,
            prompt::write_project_claude_md,
            // Skills
            skills::list_skills,
            skills::read_skill,
            // Plugins
            plugins::list_plugins,
            plugins::set_plugin_enabled,
            // Hooks
            hooks::read_hooks,
            hooks::write_hooks,
        ])
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用时出错");
}
