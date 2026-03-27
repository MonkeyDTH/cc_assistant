import { useEffect, useState } from "react";
import { MessageSquare, Clock, ChevronRight, Search, X } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { api } from "@/lib/tauri-api";
import { getProjectName } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { ConversationDetail } from "./ConversationDetail";
import type { ConversationMeta, HistoryEntry } from "@/lib/types";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function shortModel(model: string | null): string {
  if (!model) return "—";
  if (model.includes("opus"))   return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku"))  return "Haiku";
  return model.split("-").slice(-2).join("-");
}

type TabMode = "sessions" | "history";

export function SessionsPage() {
  const { projects, selectedProjectId, setSelectedProject, activeSessions, preselectedSessionId, setPreselectedSession } = useAppStore();
  const [tab, setTab] = useState<TabMode>("sessions");
  const [sessions, setSessions] = useState<ConversationMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<ConversationMeta | null>(null);

  // 历史搜索
  const [searchQuery, setSearchQuery] = useState("");
  const [historyResults, setHistoryResults] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const currentProjectId = selectedProjectId ?? projects[0]?.id;
  const currentProject = projects.find((p) => p.id === currentProjectId);

  useEffect(() => {
    if (!currentProjectId || tab !== "sessions") return;
    let mounted = true;
    setSelectedSession(null);
    setLoadError(null);
    setLoading(true);
    api.listSessions(currentProjectId)
      .then((r) => {
        if (!mounted) return;
        setSessions(r);
        // 处理从 Dashboard 点击活跃会话跳转过来的预选
        if (preselectedSessionId) {
          const target = r.find((s) => s.id === preselectedSessionId);
          if (target) setSelectedSession(target);
          setPreselectedSession(null);
        }
      })
      .catch((e: unknown) => { if (mounted) setLoadError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [currentProjectId, tab]);

  useEffect(() => {
    if (tab !== "history") return;
    let mounted = true;
    setHistoryLoading(true);
    api.searchHistory(searchQuery, "", 100)
      .then((r) => { if (mounted) setHistoryResults(r); })
      .catch(() => { if (mounted) setHistoryResults([]); })
      .finally(() => { if (mounted) setHistoryLoading(false); });
    return () => { mounted = false; };
  }, [tab, searchQuery]);

  return (
    <div className="h-full flex overflow-hidden">
      {/* 左栏：列表 */}
      <div
        className="flex flex-col overflow-hidden flex-shrink-0"
        style={{ width: selectedSession ? "380px" : "100%" }}
      >
        {/* Header */}
        <header
          className="px-6 py-4 border-b flex items-center gap-3 flex-shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
        >
          {/* 标签切换 */}
          <div
            className="flex rounded-lg overflow-hidden border flex-shrink-0"
            style={{ borderColor: "var(--border)" }}
          >
            {(["sessions", "history"] as TabMode[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: tab === t ? "var(--accent)" : "var(--surface-2)",
                  color: tab === t ? "white" : "var(--text-secondary)",
                }}
              >
                {t === "sessions" ? "会话记录" : "历史输入"}
              </button>
            ))}
          </div>

          {tab === "sessions" ? (
            /* 项目切换 */
            <select
              value={currentProjectId ?? ""}
              onChange={(e) => setSelectedProject(e.target.value || null)}
              className="flex-1 text-sm px-3 py-1.5 rounded-lg outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontFamily: "inherit",
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{getProjectName(p.path)}</option>
              ))}
            </select>
          ) : (
            /* 搜索框 */
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-tertiary)" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索历史输入…"
                className="w-full pl-8 pr-8 py-1.5 rounded-lg text-sm outline-none"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={12} style={{ color: "var(--text-tertiary)" }} />
                </button>
              )}
            </div>
          )}
        </header>

        {tab === "sessions" && currentProject && (
          <div
            className="px-6 py-1.5 border-b font-mono text-xs truncate"
            style={{ borderColor: "var(--border)", color: "var(--text-tertiary)", background: "var(--surface-2)" }}
          >
            {currentProject.path.replace(/\\/g, "/")}
          </div>
        )}

        {/* 列表内容 */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {tab === "sessions" ? (
            loading ? (
              <LoadingSkeleton count={4} height="h-16" />
            ) : loadError ? (
              <EmptyState text={`加载失败: ${loadError}`} />
            ) : sessions.length === 0 ? (
              <EmptyState text="暂无会话记录" />
            ) : (
              <div className="space-y-1.5">
                {(() => {
                  const activeIds = new Set(activeSessions.map((s) => s.sessionId));
                  // 活跃会话排在最前面
                  const sorted = [...sessions].sort((a, b) => {
                    const aActive = activeIds.has(a.id) ? 0 : 1;
                    const bActive = activeIds.has(b.id) ? 0 : 1;
                    return aActive - bActive;
                  });
                  return sorted.map((session, i) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isSelected={selectedSession?.id === session.id}
                      isActive={activeIds.has(session.id)}
                      animDelay={i * 25}
                      onClick={() => setSelectedSession(session)}
                    />
                  ));
                })()}
              </div>
            )
          ) : (
            historyLoading ? (
              <LoadingSkeleton count={4} height="h-12" />
            ) : historyResults.length === 0 ? (
              <EmptyState text="无匹配记录" />
            ) : (
              <div className="space-y-1.5">
                {historyResults.map((entry, i) => (
                  <HistoryItem key={`${entry.timestamp}-${i}`} entry={entry} animDelay={i * 20} />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* 右栏：会话详情 */}
      {selectedSession && currentProjectId && (
        <>
          <div style={{ width: "1px", background: "var(--border)", flexShrink: 0 }} />
          <div className="flex-1 overflow-hidden">
            <ConversationDetail
              projectId={currentProjectId}
              sessionId={selectedSession.id}
              firstMessage={selectedSession.first_message}
              onClose={() => setSelectedSession(null)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function SessionItem({ session, isSelected, isActive, animDelay, onClick }: {
  session: ConversationMeta;
  isSelected: boolean;
  isActive: boolean;
  animDelay: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 animate-fade-in-up transition-colors"
      style={{
        background: isSelected ? "rgba(217,113,57,0.08)" : isActive ? "rgba(217,113,57,0.04)" : "var(--surface-card)",
        border: `1px solid ${isSelected ? "rgba(217,113,57,0.25)" : isActive ? "rgba(217,113,57,0.15)" : "var(--border)"}`,
        borderLeft: isActive ? "3px solid var(--accent)" : undefined,
        boxShadow: "var(--shadow-sm)",
        animationDelay: `${animDelay}ms`,
      }}
    >
      {isActive ? (
        <div
          className="w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center"
        >
          <div
            className="w-2 h-2 rounded-full animate-pulse-dot"
            style={{ background: "var(--accent)" }}
          />
        </div>
      ) : (
        <MessageSquare size={15} style={{ color: isSelected ? "var(--accent)" : "var(--text-tertiary)", flexShrink: 0 }} />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {session.first_message ?? "（空会话）"}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
            <Clock size={10} /> {formatTime(session.started_at)}
          </span>
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {session.message_count} 条
          </span>
          <span
            className="font-mono text-xs px-1.5 py-0.5 rounded"
            style={{ background: "var(--surface-2)", color: "var(--text-tertiary)", fontSize: "10px" }}
          >
            {shortModel(session.model)}
          </span>
          {isActive && (
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
              style={{
                background: "rgba(217,113,57,0.12)",
                border: "1px solid rgba(217,113,57,0.25)",
              }}
            >
              <div
                className="w-1 h-1 rounded-full animate-pulse-dot"
                style={{ background: "var(--accent)" }}
              />
              <span style={{ color: "var(--accent)", fontSize: "10px", fontWeight: 500 }}>活跃</span>
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={13} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
    </button>
  );
}

function HistoryItem({ entry, animDelay }: { entry: HistoryEntry; animDelay: number }) {
  const projectName = entry.project
    ? entry.project.replace(/\\/g, "/").split("/").filter(Boolean).pop()
    : null;
  const time = new Date(entry.timestamp).toLocaleString("zh-CN", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div
      className="rounded-xl px-4 py-3 animate-fade-in-up"
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border)",
        animationDelay: `${animDelay}ms`,
      }}
    >
      <p className="text-sm" style={{ color: "var(--text-primary)", lineHeight: "1.5" }}>
        {entry.display}
      </p>
      <div className="flex items-center gap-3 mt-1">
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{time}</span>
        {projectName && (
          <span
            className="font-mono text-xs px-1.5 py-0.5 rounded"
            style={{ background: "var(--surface-2)", color: "var(--text-tertiary)", fontSize: "10px" }}
          >
            {projectName}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2">
      <MessageSquare size={28} style={{ color: "var(--text-tertiary)" }} />
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{text}</p>
    </div>
  );
}
