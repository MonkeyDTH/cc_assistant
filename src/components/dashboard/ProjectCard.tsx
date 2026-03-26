import { FolderOpen, MessageSquare, Clock, FileText } from "lucide-react";
import type { Project, ActiveSession } from "@/lib/types";
import { getProjectName, getProjectDir, formatRelativeTime } from "@/lib/utils";

interface Props {
  project: Project;
  activeSessions: ActiveSession[];
  onSelectSessions: () => void;
  onEditPrompt: () => void;
  style?: React.CSSProperties;
}

export function ProjectCard({ project, activeSessions, onSelectSessions, onEditPrompt, style }: Props) {
  const activeSession = activeSessions.find((s) =>
    s.cwd.toLowerCase().replace(/\\/g, "/").includes(
      project.path.toLowerCase().replace(/\\/g, "/")
    )
  );
  const isActive = activeSession != null;

  return (
    <div
      className="card-hover rounded-xl p-5 flex flex-col gap-4 animate-fade-in-up"
      style={{
        background: "var(--surface-card)",
        border: `1px solid ${isActive ? "rgba(217,113,57,0.3)" : "var(--border)"}`,
        boxShadow: isActive
          ? "0 0 0 1px rgba(217,113,57,0.15), var(--shadow-sm)"
          : "var(--shadow-sm)",
        ...style,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: isActive ? "var(--accent-glow)" : "var(--surface-2)",
              border: `1px solid ${isActive ? "rgba(217,113,57,0.3)" : "var(--border)"}`,
            }}
          >
            <FolderOpen size={15} style={{ color: isActive ? "var(--accent)" : "var(--text-secondary)" }} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
              {getProjectName(project.path)}
            </div>
            <div className="font-mono text-xs truncate" style={{ color: "var(--text-tertiary)", fontSize: "10px" }}>
              {getProjectDir(project.path)}
            </div>
          </div>
        </div>

        {isActive && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-full flex-shrink-0"
            style={{
              background: "rgba(217,113,57,0.12)",
              border: "1px solid rgba(217,113,57,0.25)",
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: "var(--accent)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--accent)", fontSize: "11px" }}>
              运行中
            </span>
          </div>
        )}
      </div>

      {activeSession && (
        <div
          className="rounded-lg px-3 py-2 font-mono text-xs"
          style={{ background: "var(--editor-bg)", color: "rgba(217,113,57,0.8)", fontSize: "11px" }}
        >
          <span style={{ color: "#64748b" }}>PID </span>
          {activeSession.pid}
          <span style={{ color: "#64748b" }}> · </span>
          {activeSession.kind ?? "interactive"}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={13} style={{ color: "var(--text-tertiary)" }} />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {project.session_count}
            </span>{" "}
            次会话
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={13} style={{ color: "var(--text-tertiary)" }} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {formatRelativeTime(project.last_session_at)}
          </span>
        </div>
      </div>

      <div className="flex gap-2 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={onSelectSessions}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--accent)";
            e.currentTarget.style.color = "white";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--surface-2)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          <MessageSquare size={12} />
          会话记录
        </button>

        <button
          onClick={onEditPrompt}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
          data-has-md={project.has_project_claude_md ? "1" : "0"}
          style={{
            background: project.has_project_claude_md ? "rgba(217,113,57,0.1)" : "var(--surface-2)",
            color: project.has_project_claude_md ? "var(--accent)" : "var(--text-secondary)",
            border: project.has_project_claude_md ? "1px solid rgba(217,113,57,0.2)" : "1px solid transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--accent)";
            e.currentTarget.style.color = "white";
            e.currentTarget.style.border = "1px solid transparent";
          }}
          onMouseLeave={(e) => {
            const hasMd = e.currentTarget.dataset.hasMd === "1";
            e.currentTarget.style.background = hasMd ? "rgba(217,113,57,0.1)" : "var(--surface-2)";
            e.currentTarget.style.color = hasMd ? "var(--accent)" : "var(--text-secondary)";
            e.currentTarget.style.border = hasMd ? "1px solid rgba(217,113,57,0.2)" : "1px solid transparent";
          }}
        >
          <FileText size={12} />
          {project.has_project_claude_md ? "编辑 Prompt" : "添加 Prompt"}
        </button>
      </div>
    </div>
  );
}
