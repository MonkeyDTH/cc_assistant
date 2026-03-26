import { useEffect, useState } from "react";
import { Zap, Link, FileText, X } from "lucide-react";
import { api } from "@/lib/tauri-api";
import type { Skill } from "@/lib/types";

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Skill | null>(null);
  const [skillContent, setSkillContent] = useState<string>("");
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.listSkills()
      .then(setSkills)
      .finally(() => setLoading(false));
  }, []);

  async function handleSelect(skill: Skill) {
    setSelected(skill);
    if (!skill.path) return;
    setContentLoading(true);
    try {
      const content = await api.readSkill(skill.path);
      setSkillContent(content);
    } finally {
      setContentLoading(false);
    }
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* 左侧列表 */}
      <div className="flex flex-col overflow-hidden" style={{ width: selected ? "340px" : "100%", flexShrink: 0 }}>
        <header
          className="px-6 py-5 border-b flex-shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
        >
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Skills</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {skills.length} 个已安装
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--surface-2)" }} />
              ))}
            </div>
          ) : skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <Zap size={32} style={{ color: "var(--text-tertiary)" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>未找到已安装的 Skills</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {skills.map((skill, i) => (
                <button
                  key={skill.name}
                  onClick={() => handleSelect(skill)}
                  className="w-full text-left rounded-xl px-4 py-3.5 flex items-center gap-3 animate-fade-in-up transition-colors"
                  style={{
                    background: selected?.name === skill.name ? "rgba(217,113,57,0.08)" : "var(--surface-card)",
                    border: `1px solid ${selected?.name === skill.name ? "rgba(217,113,57,0.25)" : "var(--border)"}`,
                    boxShadow: "var(--shadow-sm)",
                    animationDelay: `${i * 30}ms`,
                  }}
                  onMouseEnter={(e) => {
                    if (selected?.name !== skill.name) {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(217,113,57,0.2)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selected?.name !== skill.name) {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                    }
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: selected?.name === skill.name ? "rgba(217,113,57,0.15)" : "var(--surface-2)",
                      border: `1px solid ${selected?.name === skill.name ? "rgba(217,113,57,0.3)" : "var(--border)"}`,
                    }}
                  >
                    <Zap size={14} style={{ color: selected?.name === skill.name ? "var(--accent)" : "var(--text-tertiary)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-sm truncate" style={{ color: "var(--text-primary)" }}>
                        {skill.name}
                      </span>
                      {skill.is_symlink && (
                        <Link size={10} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                      )}
                    </div>
                    {skill.description && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
                        {skill.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右侧内容面板 */}
      {selected && (
        <>
          <div style={{ width: "1px", background: "var(--border)", flexShrink: 0 }} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0"
              style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
            >
              <div className="flex items-center gap-2">
                <FileText size={15} style={{ color: "var(--accent)" }} />
                <span className="font-mono font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                  {selected.name}
                </span>
                {selected.is_symlink && (
                  <span
                    className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                    style={{ background: "var(--surface-2)", color: "var(--text-tertiary)", fontSize: "10px" }}
                  >
                    <Link size={9} /> symlink
                  </span>
                )}
              </div>
              <button onClick={() => setSelected(null)}>
                <X size={16} style={{ color: "var(--text-tertiary)" }} />
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto p-4"
              style={{ background: "#1a1f2e" }}
            >
              {contentLoading ? (
                <div className="flex items-center justify-center h-32">
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>加载中…</span>
                </div>
              ) : (
                <pre
                  className="font-mono text-xs leading-relaxed whitespace-pre-wrap"
                  style={{ color: "#e2e8f0", fontSize: "12px" }}
                >
                  {skillContent || "（空文件）"}
                </pre>
              )}
            </div>

            {selected.path && (
              <div
                className="px-4 py-2 border-t font-mono text-xs"
                style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0e1117", color: "rgba(255,255,255,0.3)", fontSize: "10px" }}
              >
                {selected.path.replace(/\\/g, "/")}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
