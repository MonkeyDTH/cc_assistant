import type {
  Project,
  ActiveSession,
  ConversationMeta,
  ConversationRecord,
  Settings,
  Skill,
  PluginInfo,
  HooksConfig,
  MemoryEntry,
  HistoryEntry,
  Marketplace,
  MarketplacePlugin,
  ProfilesConfig,
  AppConfig,
} from "./types";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// 模块级缓存，避免每次 invoke 都动态 import
let _tauriInvoke: (<T>(cmd: string, args?: Record<string, unknown>) => Promise<T>) | null = null;
async function getTauriInvoke() {
  if (!_tauriInvoke) {
    const mod = await import("@tauri-apps/api/core");
    _tauriInvoke = mod.invoke;
  }
  return _tauriInvoke;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    return (await getTauriInvoke())(cmd, args);
  }
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
        total_input_tokens: 128400,
        total_output_tokens: 32100,
        total_cache_write_tokens: 139800,
        total_cache_read_tokens: 1800000,
      },
      {
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        project_id: "D--Projects-Personal-cc_assistant",
        first_message: "初始化项目骨架，Tauri + React 技术栈",
        message_count: 23,
        started_at: new Date(Date.now() - 7200000).toISOString(),
        model: "claude-opus-4-6",
        total_input_tokens: 54200,
        total_output_tokens: 18900,
        total_cache_write_tokens: 0,
        total_cache_read_tokens: 320000,
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

    read_conversation: [
      { uuid: "1", parentUuid: null, type: "user", timestamp: new Date().toISOString(), sessionId: "mock",
        message: { role: "user", content: "帮我设计一个 Claude Code 管理面板应用" } },
      { uuid: "2", parentUuid: "1", type: "assistant", timestamp: new Date().toISOString(), sessionId: "mock",
        message: { role: "assistant", model: "claude-sonnet-4-6",
          content: [{ type: "thinking", thinking: "用户想要一个管理面板..." },
                    { type: "text", text: "好的，我来帮你设计这个应用。\n\n首先，我们需要确定核心功能..." }] } },
      { uuid: "3", parentUuid: "2", type: "user", timestamp: new Date().toISOString(), sessionId: "mock",
        message: { role: "user", content: "需要支持 Prompt 管理和 Hook 配置" } },
      { uuid: "4", parentUuid: "3", type: "assistant", timestamp: new Date().toISOString(), sessionId: "mock",
        message: { role: "assistant", model: "claude-sonnet-4-6",
          content: [{ type: "text", text: "明白，我将在设计中包含这两个核心功能。" }] } },
    ] as ConversationRecord[],

    list_memories: [
      { file_name: "user_role.md", path: "", name: "用户角色", description: "用户是全栈开发者，主要使用 TypeScript 和 Rust",
        memory_type: "user", content: "---\nname: 用户角色\ndescription: 用户是全栈开发者\ntype: user\n---\n\n用户是全栈开发者，主要使用 TypeScript 和 Rust。" },
      { file_name: "feedback_testing.md", path: "", name: "测试反馈", description: "集成测试必须访问真实数据库",
        memory_type: "feedback", content: "---\nname: 测试反馈\ndescription: 集成测试必须访问真实数据库\ntype: feedback\n---\n\n集成测试必须访问真实数据库，不要使用 mock。" },
    ] as MemoryEntry[],

    read_memory: "---\nname: 示例\ndescription: 示例描述\ntype: user\n---\n\n示例 Memory 内容。",

    search_history: [
      { display: "帮我设计一个 Claude Code 管理面板应用", timestamp: Date.now() - 1000, project: "D:\\Projects\\Personal\\cc_assistant", session_id: null },
      { display: "初始化 Tauri + React 项目骨架", timestamp: Date.now() - 7200000, project: "D:\\Projects\\Personal\\cc_assistant", session_id: null },
      { display: "实现仪表盘组件", timestamp: Date.now() - 10800000, project: "D:\\Projects\\Personal\\cc_assistant", session_id: null },
    ] as HistoryEntry[],

    read_project_settings: {} as Settings,

    get_env_vars: {
      ANTHROPIC_DEFAULT_OPUS_MODEL:   "claude-opus-4-6[1m]",
      ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-4-6[1m]",
      ANTHROPIC_DEFAULT_HAIKU_MODEL:  "claude-haiku-4-5",
    } as Record<string, string>,

    read_app_config: { minimize_to_tray: false } as AppConfig,

    list_marketplaces: [
      { id: "claude-plugins-official", source: { source: "github", repo: "anthropics/claude-plugins-official" }, install_location: "", last_updated: new Date().toISOString() },
    ] as Marketplace[],

    list_marketplace_plugins: [
      { id: "superpowers@claude-plugins-official", name: "superpowers", marketplace_id: "claude-plugins-official", version: "5.0.5", description: "超能力技能集合", homepage: null, keywords: ["skills", "tdd"], installed: true, installed_version: "5.0.5" },
      { id: "claude-md-management@claude-plugins-official", name: "claude-md-management", marketplace_id: "claude-plugins-official", version: "1.2.0", description: "CLAUDE.md 管理工具", homepage: null, keywords: ["prompt", "claude-md"], installed: false, installed_version: null },
      { id: "code-review@claude-plugins-official", name: "code-review", marketplace_id: "claude-plugins-official", version: "0.3.0", description: "代码审查工具", homepage: null, keywords: ["review", "code"], installed: false, installed_version: null },
      { id: "commit-commands@claude-plugins-official", name: "commit-commands", marketplace_id: "claude-plugins-official", version: "1.0.0", description: "Git commit 命令集", homepage: null, keywords: ["git", "commit"], installed: false, installed_version: null },
    ] as MarketplacePlugin[],

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

    read_profiles: {
      activeProfileId: "mock-profile-1",
      profiles: [
        {
          id: "mock-profile-1",
          name: "官方 Anthropic",
          apiKey: "sk-ant-api03-mockkey",
          baseUrl: "",
          models: {
            opus: "claude-opus-4-6",
            sonnet: "claude-sonnet-4-6",
            haiku: "claude-haiku-4-5-20251001",
          },
        },
        {
          id: "mock-profile-2",
          name: "第三方代理",
          apiKey: "sk-proxy-mockkey",
          baseUrl: "https://api.example.com/v1",
          models: {
            opus: "gpt-4o",
            sonnet: "gpt-4o-mini",
            haiku: "gpt-3.5-turbo",
          },
        },
      ],
    } as ProfilesConfig,
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
    invoke<ConversationMeta[]>("list_sessions", { projectId }),
  readConversation: (projectId: string, sessionId: string) =>
    invoke<ConversationRecord[]>("read_conversation", { projectId, sessionId }),
  deleteSession: (projectId: string, sessionId: string) =>
    invoke<void>("delete_session", { projectId, sessionId }),
  deleteProject: (projectId: string) =>
    invoke<void>("delete_project", { projectId }),
  resumeSession: (projectPath: string, sessionId: string) =>
    invoke<void>("resume_session", { projectPath, sessionId }),

  // Memory
  listMemories: (projectId?: string | null) =>
    invoke<MemoryEntry[]>("list_memories", { projectId: projectId ?? null }),
  readMemory: (path: string) => invoke<string>("read_memory", { path }),
  writeMemory: (fileName: string, content: string, projectId?: string | null) =>
    invoke<void>("write_memory", { fileName, content, projectId: projectId ?? null }),
  deleteMemory: (fileName: string, projectId?: string | null) =>
    invoke<void>("delete_memory", { fileName, projectId: projectId ?? null }),

  // 历史搜索
  searchHistory: (query: string, projectFilter: string, limit: number) =>
    invoke<HistoryEntry[]>("search_history", { query, projectFilter, limit }),

  // 项目级 Settings
  readProjectSettings: (projectPath: string) =>
    invoke<Settings>("read_project_settings", { projectPath }),
  writeProjectSettings: (projectPath: string, settings: Settings) =>
    invoke<void>("write_project_settings", { projectPath, settings }),

  // 插件市场
  listMarketplaces: () => invoke<Marketplace[]>("list_marketplaces"),
  listMarketplacePlugins: () => invoke<MarketplacePlugin[]>("list_marketplace_plugins"),

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
    invoke<void>("set_plugin_enabled", { pluginId, enabled }),

  // Hooks
  readHooks: () => invoke<HooksConfig>("read_hooks"),
  writeHooks: (hooks: HooksConfig) => invoke<void>("write_hooks", { hooks }),

  // 激活会话终端窗口
  activateSessionWindow: (pid: number, cwd: string) =>
    invoke<void>("activate_session_window", { pid, cwd }),

  // 环境变量
  getEnvVars: (names: string[]) => invoke<Record<string, string>>("get_env_vars", { names }),

  // API Profiles
  readProfiles: () => invoke<ProfilesConfig>("read_profiles"),
  writeProfiles: (config: ProfilesConfig) => invoke<void>("write_profiles", { config }),
  activateProfile: (profileId: string) => invoke<void>("activate_profile", { profileId }),

  // App 偏好设置
  readAppConfig: () => invoke<AppConfig>("read_app_config"),
  writeAppConfig: (config: AppConfig) => invoke<void>("write_app_config", { config }),

  // Prompt
  readGlobalClaudeMd: () => invoke<string>("read_global_claude_md"),
  writeGlobalClaudeMd: (content: string) =>
    invoke<void>("write_global_claude_md", { content }),
  readProjectClaudeMd: (projectPath: string) =>
    invoke<string>("read_project_claude_md", { projectPath }),
  writeProjectClaudeMd: (projectPath: string, content: string) =>
    invoke<void>("write_project_claude_md", { projectPath, content }),
};
