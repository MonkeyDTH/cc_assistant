// ——— 项目 & 会话 ———

export interface Project {
  id: string;           // 编码后目录名，用作唯一 ID
  path: string;         // 解码后的原始路径
  session_count: number;
  last_session_at: string | null;
  has_project_claude_md: boolean;
}

export interface ActiveSession {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;    // Unix ms
  kind: string | null;
}

export interface ConversationMeta {
  id: string;
  project_id: string;
  first_message: string | null;
  message_count: number;
  started_at: string | null;
  model: string | null;
}

// ——— Settings ———

export interface Permissions {
  allow?: string[];
  deny?: string[];
  ask?: string[];
}

export interface HookEntry {
  type: "command";
  command: string;
  async?: boolean;
}

export interface HookMatcher {
  matcher?: string;
  hooks: HookEntry[];
}

export type HooksConfig = Record<string, HookMatcher[]>;

export interface Settings {
  env?: Record<string, string>;
  permissions?: Permissions;
  hooks?: HooksConfig;
  model?: string;
  language?: string;
  enabledPlugins?: Record<string, boolean>;
  [key: string]: unknown;
}

// ——— Skills ———

export interface Skill {
  name: string;
  description: string;
  path: string;
  // Rust 返回 snake_case
  is_symlink: boolean;
}

// ——— Plugins ———

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string | null;
  homepage: string | null;
  installed_at: string;
  scope: string;
  enabled: boolean;
  install_path: string;
}

// ——— UI 状态 ———

export type NavItem =
  | "dashboard"
  | "prompt"
  | "skills"
  | "plugins"
  | "hooks"
  | "sessions"
  | "settings";
