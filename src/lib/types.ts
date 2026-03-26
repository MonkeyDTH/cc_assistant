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

// ——— Memory ———

export interface MemoryEntry {
  file_name: string;
  path: string;
  name: string;
  description: string;
  memory_type: string;  // user / feedback / project / reference
  content: string;
}

// ——— 历史记录 ———

export interface HistoryEntry {
  display: string;
  timestamp: number;
  project: string | null;
  session_id: string | null;
}

// ——— 会话消息（JSONL 记录） ———

export interface ConversationRecord {
  uuid: string;
  parentUuid: string | null;
  type: "user" | "assistant" | "progress" | "file-history-snapshot";
  timestamp: string;
  sessionId: string;
  isSidechain?: boolean;
  message?: {
    role?: string;
    content?: string | ContentBlock[];
    model?: string;
    stop_reason?: string;
    usage?: { input_tokens: number; output_tokens: number };
  };
  // progress 字段
  toolUseID?: string;
  hookEvent?: string;
  data?: { type: string; [key: string]: unknown };
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature?: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string | ContentBlock[] };

// ——— 插件市场 ———

export interface Marketplace {
  id: string;
  source: { source: string; repo: string | null };
  install_location: string;
  last_updated: string | null;
}

export interface MarketplacePlugin {
  id: string;
  name: string;
  marketplace_id: string;
  version: string | null;
  description: string | null;
  homepage: string | null;
  keywords: string[];
  installed: boolean;
  installed_version: string | null;
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
