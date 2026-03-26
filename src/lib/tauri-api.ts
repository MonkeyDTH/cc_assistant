import type {
  Project,
  ActiveSession,
  ConversationMeta,
  Settings,
  Skill,
  PluginInfo,
  HooksConfig,
} from "./types";

// 运行时检测是否在 Tauri 环境中
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args);
  }
  // 浏览器开发模式：返回 mock 数据
  return mockInvoke<T>(cmd, args);
}

// ——— Mock 数据（浏览器开发用）———

function mockInvoke<T>(cmd: string, _args?: Record<string, unknown>): T {
  const now = new Date().toISOString();
  const mocks: Record<string, unknown> = {
    list_projects: [
      {
        id: "D--Projects-Personal-cc_assistant",
        path: "D:\\Projects\\Personal\\cc_assistant",
        session_count: 12,
        last_session_at: now,
        has_project_claude_md: false,
      },
      {
        id: "D--Projects-BigData-AITranslate-dify-proxy",
        path: "D:\\Projects\\BigData\\AITranslate\\dify-proxy",
        session_count: 5,
        last_session_at: new Date(Date.now() - 3600000).toISOString(),
        has_project_claude_md: true,
      },
      {
        id: "D--Projects-Personal-ClaudeCode",
        path: "D:\\Projects\\Personal\\ClaudeCode",
        session_count: 38,
        last_session_at: new Date(Date.now() - 86400000).toISOString(),
        has_project_claude_md: true,
      },
    ] as Project[],

    get_active_sessions: [
      {
        pid: 29932,
        sessionId: "f9b2e912-8d7b-4763-a7b5-72e84dbb6fb7",
        cwd: "D:\\Projects\\Personal\\cc_assistant",
        startedAt: Date.now() - 120000,
        kind: "interactive",
      },
    ] as ActiveSession[],

    list_sessions: [
      {
        id: "f9b2e912-8d7b-4763-a7b5-72e84dbb6fb7",
        project_id: "D--Projects-Personal-cc_assistant",
        first_message: "帮我设计一个 Claude Code 管理面板应用",
        message_count: 47,
        started_at: now,
        model: "claude-sonnet-4-6",
      },
      {
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        project_id: "D--Projects-Personal-cc_assistant",
        first_message: "初始化项目骨架，Tauri + React 技术栈",
        message_count: 23,
        started_at: new Date(Date.now() - 7200000).toISOString(),
        model: "claude-opus-4-6",
      },
    ] as ConversationMeta[],

    read_global_claude_md:
      `## 语言要求\n- 始终使用简体中文回答\n\n## 编码规范\n- 代码注释使用中文\n- 优先使用函数式写法`,

    read_settings: {
      model: "opus[1m]",
      language: "简体中文",
      permissions: {
        allow: ["Bash(git status*)", "Read(*)", "Edit(*)", "Write(*)"],
        deny: ["Read(./.env)"],
      },
      hooks: {
        Notification: [{ hooks: [{ type: "command", command: "echo notified", async: true }] }],
      },
    } as Settings,

    read_conversation: [],

    list_skills: [
      { name: "commit",          description: "生成 git commit message 并提交代码",  path: "", is_symlink: false },
      { name: "doc-first",       description: "先写设计文档再动代码的工作流",           path: "", is_symlink: false },
      { name: "frontend-design", description: "创建高质量前端界面",                     path: "", is_symlink: true  },
      { name: "agent-browser",   description: "浏览器自动化 CLI",                       path: "", is_symlink: true  },
      { name: "install-skill",   description: "安装 Claude Code 技能",                  path: "", is_symlink: false },
    ] as Skill[],

    read_skill: "# Skill\n\n这是 skill 的内容",

    list_plugins: [
      { id: "claude-hud@claude-hud",              name: "claude-hud",   version: "0.0.11", description: "状态栏 HUD 插件",   enabled: true,  scope: "user", installed_at: new Date().toISOString(), install_path: "", homepage: null },
      { id: "superpowers@claude-plugins-official", name: "superpowers",  version: "5.0.5",  description: "超能力技能集合",    enabled: true,  scope: "user", installed_at: new Date().toISOString(), install_path: "", homepage: null },
    ] as PluginInfo[],

    read_hooks: {
      Notification: [{ hooks: [{ type: "command", command: "echo notified", async: true }] }],
    } as HooksConfig,
  };

  const result = mocks[cmd];
  if (result === undefined) {
    console.warn(`[mock] 未找到命令 mock: ${cmd}`);
    return null as T;
  }
  return result as T;
}

// ——— 公开 API ———

export const api = {
  // 项目
  listProjects: () => invoke<Project[]>("list_projects"),
  getActiveSessions: () => invoke<ActiveSession[]>("get_active_sessions"),
  listSessions: (projectId: string) =>
    invoke<ConversationMeta[]>("list_sessions", { project_id: projectId }),
  readConversation: (projectId: string, sessionId: string) =>
    invoke<unknown[]>("read_conversation", { project_id: projectId, session_id: sessionId }),

  // Settings
  readSettings: () => invoke<Settings>("read_settings"),
  writeSettings: (settings: Settings) =>
    invoke<void>("write_settings", { settings }),

  // Skills
  listSkills: () => invoke<Skill[]>("list_skills"),
  readSkill: (path: string) => invoke<string>("read_skill", { path }),

  // Plugins
  listPlugins: () => invoke<PluginInfo[]>("list_plugins"),
  setPluginEnabled: (pluginId: string, enabled: boolean) =>
    invoke<void>("set_plugin_enabled", { plugin_id: pluginId, enabled }),

  // Hooks
  readHooks: () => invoke<HooksConfig>("read_hooks"),
  writeHooks: (hooks: HooksConfig) => invoke<void>("write_hooks", { hooks }),

  // Prompt
  readGlobalClaudeMd: () => invoke<string>("read_global_claude_md"),
  writeGlobalClaudeMd: (content: string) =>
    invoke<void>("write_global_claude_md", { content }),
  readProjectClaudeMd: (projectPath: string) =>
    invoke<string>("read_project_claude_md", { project_path: projectPath }),
  writeProjectClaudeMd: (projectPath: string, content: string) =>
    invoke<void>("write_project_claude_md", { project_path: projectPath, content }),
};
