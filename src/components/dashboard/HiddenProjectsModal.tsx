import { Eye, X, FolderOpen } from "lucide-react";
import type { Project } from "@/lib/types";
import { getProjectName, getProjectDir } from "@/lib/utils";

interface Props {
  hiddenProjects: Project[];
  onUnhide: (projectId: string) => void;
  onClose: () => void;
}

export function HiddenProjectsModal({ hiddenProjects, onUnhide, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-xl w-full max-w-md mx-4 flex flex-col"
        style={{ background: "var(--surface-card)", border: "1px solid var(--border)", maxHeight: "70vh" }}
      >
        {/* 标题栏 */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Eye size={16} style={{ color: "var(--text-secondary)" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              已屏蔽的项目
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-mono"
              style={{ background: "var(--surface-2)", color: "var(--text-tertiary)" }}
            >
              {hiddenProjects.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 列表 */}
        <div className="overflow-y-auto flex-1 p-3">
          {hiddenProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FolderOpen size={32} style={{ color: "var(--text-tertiary)" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>暂无屏蔽的项目</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {hiddenProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
                  style={{ background: "var(--surface-2)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {getProjectName(project.path)}
                    </div>
                    <div
                      className="font-mono text-xs truncate mt-0.5"
                      style={{ color: "var(--text-tertiary)", fontSize: "10px" }}
                    >
                      {getProjectDir(project.path)}
                    </div>
                  </div>
                  <button
                    onClick={() => onUnhide(project.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-colors"
                    style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#6366f1";
                      e.currentTarget.style.color = "white";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(99,102,241,0.12)";
                      e.currentTarget.style.color = "#6366f1";
                    }}
                  >
                    <Eye size={12} />
                    恢复显示
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
