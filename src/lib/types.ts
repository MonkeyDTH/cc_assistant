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
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_write_tokens: number;
  total_cache_read_tokens: number;
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
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
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

// ——— API Profiles ———

export interface ProfileModels {
  opus: string;
  sonnet: string;
  haiku: string;
}

export interface ApiProfile {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;  // 空字符串表示使用默认端点
  models: ProfileModels;
  extraEnvVars?: Record<string, string>;   // 额外环境变量；空字符串值 = 删除该 key
}

export interface ProfilesConfig {
  activeProfileId: string | null;
  profiles: ApiProfile[];
}

// ——— App 偏好设置（CC Assistant 自身，与 Claude Code settings.json 无关）———

export interface AppConfig {
  minimize_to_tray: boolean;
  hidden_project_ids: string[];
}

// ——— Codeburn 用量数据 ———

export interface CodburnSummary {
  Period: string;
  "Cost (USD)": number;
  "API Calls": number;
  Sessions: number;
  Projects: number;
}

export interface CodburnDailyEntry {
  Period: string;
  Date: string;
  "Cost (USD)": number;
  "API Calls": number;
  Sessions: number;
  "Input Tokens": number;
  "Output Tokens": number;
  "Cache Read Tokens": number;
  "Cache Write Tokens": number;
}

export interface CodburnActivityEntry {
  Period: string;
  Activity: string;
  "Cost (USD)": number;
  "Share (%)": number;
  Turns: number;
}

export interface CodburnModelEntry {
  Period: string;
  Model: string;
  "Cost (USD)": number;
  "Share (%)": number;
  "API Calls": number;
  "Input Tokens": number;
  "Output Tokens": number;
  "Cache Read Tokens": number;
  "Cache Write Tokens": number;
}

export interface CodburnPeriod {
  label: string;
  daily: CodburnDailyEntry[];
  activity: CodburnActivityEntry[];
  models: CodburnModelEntry[];
}

export interface CodburnProject {
  Project: string;
  "Cost (USD)": number;
  "Avg/Session (USD)": number;
  "Share (%)": number;
  "API Calls": number;
  Sessions: number;
}

export interface CodburnCurrency {
  code: string;
  rate: number;
  symbol: string;
}

export interface CodburnSession {
  Project: string;
  "Session ID": string;
  "Started At": string;
  "Cost (USD)": number;
  "API Calls": number;
  Turns: number;
}

export interface CodburnData {
  schema: string;
  generated: string;
  currency: CodburnCurrency;
  summary: CodburnSummary[];
  periods: CodburnPeriod[];
  projects: CodburnProject[];
  sessions: CodburnSession[];
}

// ——— UI 状态 ———

export type NavItem =
  | "dashboard"
  | "prompt"
  | "memory"
  | "skills"
  | "plugins"
  | "hooks"
  | "sessions"
  | "model"
  | "permission"
  | "profiles"
  | "preferences"
  | "usage";
