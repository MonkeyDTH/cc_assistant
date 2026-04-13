import { useMemo } from "react";
import { RefreshCw, FolderOpen, Cpu, MessageSquare, Layers } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { encodeCwdToProjectId } from "@/lib/utils";
import { ProjectCard } from "./ProjectCard";
import { ActiveSessionsPanel } from "./ActiveSessionsPanel";

export function Dashboard() {
  const {
    projects,
    activeSessions,
    projectsLoading,
    fetchProjects,
    setActiveNav,
    setSelectedProject,
    deleteProject,
  } = useAppStore();

  function handleSelectSessions(projectId: string) {
    setSelectedProject(projectId);
    setActiveNav("sessions");
  }

  function handleEditPrompt(projectId: string) {
    setSelectedProject(projectId);
    setActiveNav("prompt");
  }

  const totalSessions = projects.reduce((s, p) => s + p.session_count, 0);

  // 按 cwd 编码与 project.id 比对，统计有活跃会话的不重复项目数
  const activeProjectCount = useMemo(() => {
    const matched = new Set<string>();
    for (const s of activeSessions) {
      const encoded = encodeCwdToProjectId(s.cwd).toLowerCase();
      const p = projects.find((p) => p.id.toLowerCase() === encoded);
      if (p) matched.add(p.id);
    }
    return matched.size;
  }, [activeSessions, projects]);

  function handleNavigateToSession(projectId: string, sessionId: string) {
    setSelectedProject(projectId);
    useAppStore.getState().setPreselectedSession(sessionId);
    setActiveNav("sessions");
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 页面头部 */}
      <header
        className="px-8 py-5 flex items-center justify-between border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            项目仪表盘
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            管理你的 Claude Code 项目
          </p>
        </div>
        <button
          onClick={fetchProjects}
          disabled={projectsLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          <RefreshCw
            size={14}
            className={projectsLoading ? "animate-spin" : ""}
          />
          刷新
        </button>
      </header>

      {/* 统计条 */}
      <div
        className="px-8 py-4 flex gap-6 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <Stat
          icon={<FolderOpen size={14} />}
          label="项目总数"
          value={projects.length}
        />
        <div style={{ width: "1px", background: "var(--border)" }} />
        <Stat
          icon={<MessageSquare size={14} />}
          label="历史会话"
          value={totalSessions}
        />
        <div style={{ width: "1px", background: "var(--border)" }} />
        <Stat
          icon={<Layers size={14} />}
          label="活跃项目"
          value={activeProjectCount}
          highlight={activeProjectCount > 0}
        />
        <div style={{ width: "1px", background: "var(--border)" }} />
        <Stat
          icon={<Cpu size={14} />}
          label="活跃会话"
          value={activeSessions.length}
          highlight={activeSessions.length > 0}
        />
      </div>

      {/* 项目卡片区 */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* 活跃会话面板 */}
        <ActiveSessionsPanel
          activeSessions={activeSessions}
          projects={projects}
          onNavigateToSession={handleNavigateToSession}
        />

        {projectsLoading ? (
          <ProjectGridSkeleton />
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {projects.map((project, i) => (
              <ProjectCard
                key={project.id}
                project={project}
                activeSessions={activeSessions}
                onSelectSessions={() => handleSelectSessions(project.id)}
                onEditPrompt={() => handleEditPrompt(project.id)}
                onDeleteProject={() => deleteProject(project.id)}
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon, label, value, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: highlight ? "var(--accent)" : "var(--text-tertiary)" }}>{icon}</span>
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span
        className="font-semibold text-sm font-mono"
        style={{ color: highlight ? "var(--accent)" : "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}

function ProjectGridSkeleton() {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl p-5 h-48 animate-pulse"
          style={{ background: "var(--surface-2)" }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <FolderOpen size={40} style={{ color: "var(--text-tertiary)" }} />
      <div className="text-center">
        <p className="font-medium" style={{ color: "var(--text-secondary)" }}>
          暂无项目记录
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
          开始一个 Claude Code 会话后，项目将自动出现在这里
        </p>
      </div>
    </div>
  );
}
