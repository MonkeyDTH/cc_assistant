mod commands;

use commands::{
    projects, settings, prompt, skills, plugins, hooks, memory,
    history, project_settings, marketplace, env_vars, profiles, app_config,
};
use commands::app_config::{AppConfigState, load_app_config};
use tauri::{Manager, menu::{Menu, MenuItem}};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 第二个实例启动时，把已有窗口拉到前台
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // ── 加载并注册 app 配置 ──
            let config = load_app_config();
            app.manage(AppConfigState(std::sync::Mutex::new(config)));

            // ── 系统托盘 ──
            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("CC Assistant")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // 左键单击托盘图标：显示并聚焦窗口
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            // ── 窗口关闭事件处理 ──
            let app_handle = app.handle().clone();
            let main_window = app.get_webview_window("main").unwrap();
            let win_clone = main_window.clone();
            main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let state = app_handle.state::<AppConfigState>();
                    let minimize = state.0.lock().unwrap().minimize_to_tray;
                    if minimize {
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                }
            });

            Ok(())
        })
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
            // App 偏好设置
            app_config::read_app_config,
            app_config::write_app_config,
        ])
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用时出错");
}
