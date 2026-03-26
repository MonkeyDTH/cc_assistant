import { useEffect, useState } from "react";
import { MessageSquare, Clock, ChevronRight } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { api } from "@/lib/tauri-api";
import type { ConversationMeta } from "@/lib/types";

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

export function SessionsPage() {
  const { projects, selectedProjectId, setSelectedProject } = useAppStore();
  const [sessions, setSessions] = useState<ConversationMeta[]>([]);
  const [loading, setLoading] = useState(false);

  const currentProjectId = selectedProjectId ?? projects[0]?.id;
  const currentProject = projects.find((p) => p.id === currentProjectId);

  useEffect(() => {
    if (!currentProjectId) return;
    setLoading(true);
    api.listSessions(currentProjectId)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, [currentProjectId]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header
        className="px-8 py-5 border-b flex items-center gap-4 flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        <div className="flex-1">
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>会话记录</h1>
        </div>
        {/* 项目切换 */}
        <select
          value={currentProjectId ?? ""}
          onChange={(e) => setSelectedProject(e.target.value || null)}
          className="text-sm px-3 py-1.5 rounded-lg outline-none"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            fontFamily: "inherit",
          }}
        >
          {projects.map((p) => {
            const name = p.path.replace(/\\/g, "/").split("/").filter(Boolean).pop();
            return <option key={p.id} value={p.id}>{name}</option>;
          })}
        </select>
      </header>

      {/* 路径提示 */}
      {currentProject && (
        <div
          className="px-8 py-2 border-b font-mono text-xs"
          style={{ borderColor: "var(--border)", color: "var(--text-tertiary)", background: "var(--surface-2)" }}
        >
          {currentProject.path.replace(/\\/g, "/")}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--surface-2)" }} />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <MessageSquare size={32} style={{ color: "var(--text-tertiary)" }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>暂无会话记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session, i) => (
              <div
                key={session.id}
                className="rounded-xl px-5 py-4 flex items-center gap-4 cursor-pointer animate-fade-in-up"
                style={{
                  background: "var(--surface-card)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-sm)",
                  animationDelay: `${i * 30}ms`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(217,113,57,0.3)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                }}
              >
                <MessageSquare size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {session.first_message ?? "（无消息）"}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      <Clock size={11} /> {formatTime(session.started_at)}
                    </span>
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      <MessageSquare size={11} /> {session.message_count} 条
                    </span>
                    <span
                      className="font-mono text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "var(--surface-2)", color: "var(--text-tertiary)", fontSize: "10px" }}
                    >
                      {shortModel(session.model)}
                    </span>
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
