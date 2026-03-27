import { useEffect, useState, useMemo } from "react";
import { Zap, FolderOpen, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/tauri-api";
import { getProjectName, encodeCwdToProjectId } from "@/lib/utils";
import type { ActiveSession, Project, ConversationMeta } from "@/lib/types";

/** 将 Unix ms 时间戳格式化为相对时间 */
function formatRelativeMs(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  return `${days} 天前`;
}

/** 按项目分组的活跃会话 */
interface ProjectGroup {
  project: Project;
  sessions: ActiveSession[];
}

/** 将 activeSessions 按 cwd 编码与 project.id 匹配进行分组 */
function groupByProject(activeSessions: ActiveSession[], projects: Project[]): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>();

  for (const session of activeSessions) {
    const encoded = encodeCwdToProjectId(session.cwd).toLowerCase();
    const matched = projects.find((p) => p.id.toLowerCase() === encoded);
    if (!matched) continue;

    const existing = groups.get(matched.id);
    if (existing) {
      existing.sessions.push(session);
    } else {
      groups.set(matched.id, { project: matched, sessions: [session] });
    }
  }

  return Array.from(groups.values());
}

export function ActiveSessionsPanel({
  activeSessions,
  projects,
  onNavigateToSession,
}: {
  activeSessions: ActiveSession[];
  projects: Project[];
  onNavigateToSession: (projectId: string, sessionId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  // 缓存 sessionId → first_message 的映射
  const [titleMap, setTitleMap] = useState<Map<string, string>>(new Map());

  const groups = useMemo(
    () => groupByProject(activeSessions, projects),
    [activeSessions, projects],
  );

  // 获取每个活跃项目的会话列表，提取 first_message
  useEffect(() => {
    if (groups.length === 0) return;

    const activeIds = new Set(activeSessions.map((s) => s.sessionId));

    Promise.all(
      groups.map((g) =>
        api.listSessions(g.project.id).catch(() => [] as ConversationMeta[])
      )
    ).then((results) => {
      const map = new Map<string, string>();
      for (const sessions of results) {
        for (const s of sessions) {
          if (activeIds.has(s.id) && s.first_message) {
            map.set(s.id, s.first_message);
          }
        }
      }
      setTitleMap(map);
    });
  }, [groups, activeSessions]);

  if (activeSessions.length === 0) return null;

  return (
    <div
      className="rounded-xl mb-6 animate-fade-in-up overflow-hidden"
      style={{
        background: "rgba(217,113,57,0.04)",
        border: "1px solid rgba(217,113,57,0.15)",
      }}
    >
      {/* 标题栏 */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full px-5 py-3 flex items-center justify-between cursor-pointer"
        style={{ background: "rgba(217,113,57,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <Zap size={14} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            活跃会话
          </span>
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {groups.length} 个项目 · {activeSessions.length} 个进程
          </span>
        </div>
        {collapsed ? (
          <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} />
        ) : (
          <ChevronUp size={14} style={{ color: "var(--text-tertiary)" }} />
        )}
      </button>

      {/* 分组列表 */}
      {!collapsed && (
        <div className="px-5 pb-4 pt-2 space-y-3">
          {groups.map((group) => (
            <div key={group.project.id}>
              {/* 项目名 */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <FolderOpen size={12} style={{ color: "var(--text-tertiary)" }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  {getProjectName(group.project.path)}
                </span>
              </div>

              {/* 该项目下的活跃会话 */}
              <div className="space-y-1 pl-4">
                {group.sessions.map((session) => (
                  <button
                    key={session.sessionId}
                    onClick={() => onNavigateToSession(group.project.id, session.sessionId)}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                    style={{ background: "transparent" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(217,113,57,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {/* 脉动点 */}
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse-dot"
                      style={{ background: "var(--accent)" }}
                    />
                    {/* 会话标题 */}
                    <span
                      className="flex-1 text-xs truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {titleMap.get(session.sessionId) ?? session.kind ?? "interactive"}
                    </span>
                    {/* PID */}
                    <span
                      className="font-mono text-xs flex-shrink-0"
                      style={{ color: "var(--text-tertiary)", fontSize: "10px" }}
                    >
                      PID {session.pid}
                    </span>
                    {/* 相对时间 */}
                    <span
                      className="text-xs flex-shrink-0"
                      style={{ color: "var(--text-tertiary)", fontSize: "10px" }}
                    >
                      {formatRelativeMs(session.startedAt)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
