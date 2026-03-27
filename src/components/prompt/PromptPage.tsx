import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { Save, Eye, Edit3, Globe, FolderOpen } from "lucide-react";
import { api } from "@/lib/tauri-api";
import { useAppStore } from "@/stores/app-store";
import { getProjectName } from "@/lib/utils";
import { SaveStatusBadge } from "@/components/ui/SaveStatusBadge";

type Mode = "global" | "project";

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hupbl])(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
}

export function PromptPage() {
  const { selectedProjectId, projects } = useAppStore();
  const [mode, setMode] = useState<Mode>("global");
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const isDirty = content !== originalContent;
  const renderedMarkdown = useMemo(() => renderMarkdown(content), [content]);

  const loadContent = useCallback(async () => {
    setLoading(true);
    setSaveStatus("idle");
    try {
      let text = "";
      if (mode === "global") {
        text = await api.readGlobalClaudeMd();
      } else if (selectedProject) {
        text = await api.readProjectClaudeMd(selectedProject.path);
      }
      setContent(text);
      setOriginalContent(text);
    } finally {
      setLoading(false);
    }
  }, [mode, selectedProject]);

  useEffect(() => { loadContent(); }, [loadContent]);

  useEffect(() => {
    if (selectedProjectId && selectedProject) setMode("project");
  }, [selectedProjectId, selectedProject]);

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  async function handleSave() {
    setSaving(true);
    setSaveStatus("idle");
    try {
      if (mode === "global") {
        await api.writeGlobalClaudeMd(content);
      } else if (selectedProject) {
        await api.writeProjectClaudeMd(selectedProject.path, content);
      } else {
        throw new Error(`保存失败：mode=${mode}，未选中项目`);
      }
      setOriginalContent(content);
      setSaveStatus("saved");
      saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (e) {
      setSaveStatus("error");
      console.error("[PromptPage] 保存失败:", e, { mode, path: selectedProject?.path });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header
        className="px-6 py-3 border-b flex items-center gap-3 flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        {/* 全局/项目切换 */}
        <div
          className="flex rounded-lg overflow-hidden border"
          style={{ borderColor: "var(--border)" }}
        >
          <ModeTab active={mode === "global"} onClick={() => setMode("global")} icon={<Globe size={13} />} label="全局" />
          <ModeTab active={mode === "project"} onClick={() => setMode("project")} icon={<FolderOpen size={13} />} label="项目" />
        </div>

        {mode === "project" && (
          <div className="flex-1">
            <ProjectSelector />
          </div>
        )}

        <div className="flex-1" />

        <button
          onClick={() => setShowPreview((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: showPreview ? "rgba(217,113,57,0.1)" : "var(--surface-2)",
            color: showPreview ? "var(--accent)" : "var(--text-secondary)",
            border: `1px solid ${showPreview ? "rgba(217,113,57,0.25)" : "var(--border)"}`,
          }}
        >
          {showPreview ? <Edit3 size={12} /> : <Eye size={12} />}
          {showPreview ? "编辑" : "预览"}
        </button>

        <SaveStatusBadge status={saveStatus} />

        <button
          onClick={handleSave}
          disabled={saving || !isDirty || (mode === "project" && !selectedProject)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
          style={{
            background: isDirty ? "var(--accent)" : "var(--surface-2)",
            color: isDirty ? "white" : "var(--text-tertiary)",
          }}
        >
          <Save size={13} />
          {saving ? "保存中…" : "保存"}
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>加载中…</div>
          </div>
        ) : showPreview ? (
          <div className="flex-1 overflow-y-auto px-10 py-8">
            <div
              className="markdown-preview max-w-3xl mx-auto"
              dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
            />
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-hidden" style={{ background: "var(--editor-bg)" }}>
              <CodeMirror
                value={content}
                height="100%"
                extensions={[markdown()]}
                theme={oneDark}
                onChange={setContent}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: false,
                  dropCursor: true,
                  allowMultipleSelections: false,
                  indentOnInput: true,
                }}
              />
            </div>

            <div style={{ width: "1px", background: "var(--border)", flexShrink: 0 }} />

            <div className="w-2/5 overflow-y-auto px-8 py-6 flex-shrink-0" style={{ background: "var(--surface)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Eye size={13} style={{ color: "var(--text-tertiary)" }} />
                <span className="text-xs font-mono uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)", fontSize: "10px" }}>
                  实时预览
                </span>
              </div>
              <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderedMarkdown }} />
            </div>
          </div>
        )}
      </div>

      <div
        className="px-6 py-2 border-t flex items-center gap-4"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <span className="font-mono text-xs" style={{ color: "var(--text-tertiary)", fontSize: "11px" }}>
          {mode === "global" ? "~/.claude/CLAUDE.md" : selectedProject
            ? `${selectedProject.path.replace(/\\/g, "/")}/CLAUDE.md`
            : "未选择项目"}
        </span>
        {isDirty && (
          <span className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: "rgba(217,113,57,0.15)", color: "var(--accent)", fontSize: "10px" }}>
            未保存
          </span>
        )}
        <div className="flex-1" />
        <span className="font-mono text-xs" style={{ color: "var(--text-tertiary)", fontSize: "11px" }}>
          {content.length} 字符 · {content.split("\n").length} 行
        </span>
      </div>
    </div>
  );
}

function ModeTab({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
      style={{
        background: active ? "var(--accent)" : "var(--surface-2)",
        color: active ? "white" : "var(--text-secondary)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function ProjectSelector() {
  const { projects, selectedProjectId, setSelectedProject } = useAppStore();
  return (
    <select
      value={selectedProjectId ?? ""}
      onChange={(e) => setSelectedProject(e.target.value || null)}
      className="text-sm px-3 py-1.5 rounded-lg outline-none"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
        fontFamily: "inherit",
      }}
    >
      {!selectedProjectId && <option value="">选择项目…</option>}
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {getProjectName(p.path)} — {p.path}
        </option>
      ))}
    </select>
  );
}
