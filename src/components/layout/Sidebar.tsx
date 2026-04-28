import {
  LayoutDashboard,
  FileText,
  Zap,
  Puzzle,
  GitBranch,
  MessageSquare,
  Terminal,
  Activity,
  Brain,
  Cpu,
  Shield,
  KeyRound,
  ChevronDown,
  Check,
  Settings,
  BarChart2,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import pkg from "../../../package.json";
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
  { id: "usage",     label: "用量统计", icon: <BarChart2 size={16} />,       group: "概览" },
  { id: "prompt",    label: "Prompt",   icon: <FileText size={16} />,         group: "配置" },
  { id: "memory",   label: "Memory",   icon: <Brain size={16} />,            group: "配置" },
  { id: "hooks",     label: "Hooks",    icon: <GitBranch size={16} />,        group: "配置" },
  { id: "skills",    label: "Skills",   icon: <Zap size={16} />,              group: "配置" },
  { id: "plugins",    label: "Plugins",  icon: <Puzzle size={16} />,  group: "配置" },
  { id: "model",       label: "模型",        icon: <Cpu size={16} />,      group: "系统" },
  { id: "permission",  label: "权限",        icon: <Shield size={16} />,   group: "系统" },
  { id: "profiles",    label: "API Profiles", icon: <KeyRound size={16} />, group: "系统" },
  { id: "preferences", label: "应用偏好",    icon: <Settings size={16} />, group: "系统" },
];

const GROUPS = ["概览", "配置", "系统"];

export function Sidebar() {
  const { activeNav, setActiveNav, activeSessions, projects, profilesConfig, fetchProfiles, switchProfile } = useAppStore();
  const [profileDropOpen, setProfileDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // 首次挂载时加载 profiles
  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setProfileDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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

      {/* Profile 快捷切换 */}
      <div
        className="px-3 py-2 border-t"
        style={{ borderColor: "var(--sidebar-border)" }}
        ref={dropRef}
      >
        <div
          className="font-mono text-xs uppercase tracking-widest px-2 mb-1"
          style={{ color: "var(--text-sidebar-muted)", fontSize: "10px" }}
        >
          API Profile
        </div>
        <div className="relative">
          <button
            onClick={() => setProfileDropOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs"
            style={{
              background: profileDropOpen ? "var(--surface-2)" : "transparent",
              border: "1px solid var(--sidebar-border)",
              color: "var(--text-sidebar-muted)",
            }}
          >
            <KeyRound size={12} style={{ flexShrink: 0 }} />
            <span className="flex-1 text-left truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
              {profilesConfig?.activeProfileId
                ? (profilesConfig.profiles.find((p) => p.id === profilesConfig.activeProfileId)?.name ?? "未知")
                : "未选择"}
            </span>
            <ChevronDown size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
          </button>

          {profileDropOpen && (
            <div
              className="absolute bottom-full left-0 right-0 mb-1 rounded-lg py-1 z-50"
              style={{
                background: "var(--surface-card)",
                border: "1px solid var(--border)",
                boxShadow: "0 -4px 16px rgba(0,0,0,0.3)",
              }}
            >
              {(profilesConfig?.profiles ?? []).length === 0 && (
                <div className="px-3 py-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  暂无 profiles
                </div>
              )}
              {(profilesConfig?.profiles ?? []).map((profile) => {
                const isActive = profile.id === profilesConfig?.activeProfileId;
                return (
                  <button
                    key={profile.id}
                    onClick={async () => {
                      if (!isActive) await switchProfile(profile.id);
                      setProfileDropOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs"
                    style={{ color: isActive ? "var(--accent)" : "var(--text-primary)" }}
                  >
                    <span className="flex-1 text-left truncate">{profile.name}</span>
                    {isActive && <Check size={11} />}
                  </button>
                );
              })}
              <div
                className="mx-2 my-1"
                style={{ height: "1px", background: "var(--border)" }}
              />
              <button
                onClick={() => { setActiveNav("profiles"); setProfileDropOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs"
                style={{ color: "var(--text-tertiary)" }}
              >
                <Settings size={11} />
                管理 Profiles
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 底部版本信息 */}
      <div
        className="px-5 py-3 border-t"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div className="flex items-center gap-2">
          <Activity size={12} style={{ color: "var(--text-sidebar-muted)" }} />
          <span className="font-mono text-xs" style={{ color: "var(--text-sidebar-muted)" }}>
            v{pkg.version}
          </span>
        </div>
      </div>
    </aside>
  );
}
