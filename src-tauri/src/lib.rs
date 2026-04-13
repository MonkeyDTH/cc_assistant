mod commands;

use commands::{projects, settings, prompt, skills, plugins, hooks, memory, history, project_settings, marketplace, env_vars, profiles};

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
            projects::delete_session,
            projects::delete_project,
            projects::resume_session,
            projects::activate_session_window,
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
            // Memory
            memory::list_memories,
            memory::read_memory,
            memory::write_memory,
            memory::delete_memory,
            // 历史搜索
            history::search_history,
            // 项目级 Settings
            project_settings::read_project_settings,
            project_settings::write_project_settings,
            // 插件市场
            marketplace::list_marketplaces,
            marketplace::list_marketplace_plugins,
            // 环境变量读取
            env_vars::get_env_vars,
            // API Profiles
            profiles::read_profiles,
            profiles::write_profiles,
            profiles::activate_profile,
        ])
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用时出错");
}
