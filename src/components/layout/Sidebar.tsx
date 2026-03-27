import {
  LayoutDashboard,
  FileText,
  Zap,
  Puzzle,
  GitBranch,
  MessageSquare,
  Settings,
  Terminal,
  Activity,
} from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { encodeCwdToProjectId } from "@/lib/utils";
import type { NavItem } from "@/lib/types";

interface NavEntry {
  id: NavItem;
  label: string;
  icon: React.ReactNode;
  group?: string;
}

const NAV_ITEMS: NavEntry[] = [
  { id: "dashboard", label: "仪表盘",   icon: <LayoutDashboard size={16} />, group: "概览" },
  { id: "sessions",  label: "会话记录", icon: <MessageSquare size={16} />,   group: "概览" },
  { id: "prompt",    label: "Prompt",   icon: <FileText size={16} />,         group: "配置" },
  { id: "hooks",     label: "Hooks",    icon: <GitBranch size={16} />,        group: "配置" },
  { id: "skills",    label: "Skills",   icon: <Zap size={16} />,              group: "配置" },
  { id: "plugins",   label: "Plugins",  icon: <Puzzle size={16} />,           group: "配置" },
  { id: "settings",  label: "设置",     icon: <Settings size={16} />,         group: "系统" },
];

const GROUPS = ["概览", "配置", "系统"];

export function Sidebar() {
  const { activeNav, setActiveNav, activeSessions, projects } = useAppStore();

  // 活跃项目数（去重）
  const activeProjectCount = (() => {
    const matched = new Set<string>();
    for (const s of activeSessions) {
      const encoded = encodeCwdToProjectId(s.cwd).toLowerCase();
      const p = projects.find((p) => p.id.toLowerCase() === encoded);
      if (p) matched.add(p.id);
    }
    return matched.size;
  })();

  return (
    <aside
      style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}
      className="w-56 flex-shrink-0 flex flex-col h-full select-none"
    >
      {/* Logo 区 */}
      <div className="px-5 py-5 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--accent)", boxShadow: "0 0 12px var(--accent-glow)" }}
          >
            <Terminal size={15} color="white" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">CC Assistant</div>
            <div className="font-mono text-xs" style={{ color: "var(--text-sidebar-muted)" }}>
              Claude Code
            </div>
          </div>
        </div>
      </div>

      {/* 活跃会话指示 */}
      {activeSessions.length > 0 && (
        <div
          className="mx-3 mt-3 px-3 py-2 rounded-lg flex items-center gap-2"
          style={{ background: "rgba(217,113,57,0.12)", border: "1px solid rgba(217,113,57,0.2)" }}
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse-dot"
            style={{ background: "var(--accent)" }}
          />
          <span className="text-xs font-medium" style={{ color: "var(--accent-light)" }}>
            {activeProjectCount} 个项目 · {activeSessions.length} 个会话
          </span>
        </div>
      )}

      {/* 导航分组 */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto sidebar-scroll">
        {GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((n) => n.group === group);
          return (
            <div key={group} className="mb-4">
              <div
                className="font-mono text-xs uppercase tracking-widest px-2 mb-1"
                style={{ color: "var(--text-sidebar-muted)", fontSize: "10px" }}
              >
                {group}
              </div>
              {items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item w-full text-left ${activeNav === item.id ? "active" : ""}`}
                  onClick={() => setActiveNav(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      {/* 底部版本信息 */}
      <div
        className="px-5 py-3 border-t"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div className="flex items-center gap-2">
          <Activity size={12} style={{ color: "var(--text-sidebar-muted)" }} />
          <span className="font-mono text-xs" style={{ color: "var(--text-sidebar-muted)" }}>
            v0.1.0
          </span>
        </div>
      </div>
    </aside>
  );
}
