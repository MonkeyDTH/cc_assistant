import { useEffect, useState, useRef } from "react";
import { Brain, Plus, Trash2, Save, X, Filter } from "lucide-react";
import { api } from "@/lib/tauri-api";
import { SaveStatusBadge } from "@/components/ui/SaveStatusBadge";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import type { MemoryEntry } from "@/lib/types";

const MEMORY_TYPES = ["all", "user", "feedback", "project", "reference"] as const;
type MemoryTypeFilter = typeof MEMORY_TYPES[number];

const TYPE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  user:      { bg: "rgba(59,130,246,0.1)",  color: "#3b82f6", label: "用户" },
  feedback:  { bg: "rgba(168,85,247,0.1)",  color: "#a855f7", label: "反馈" },
  project:   { bg: "rgba(34,197,94,0.1)",   color: "#22c55e", label: "项目" },
  reference: { bg: "rgba(245,158,11,0.1)",  color: "#f59e0b", label: "参考" },
};

const NEW_ENTRY_TEMPLATE = `---
name: 新 Memory
description: 描述这条 memory 的内容
type: user
---

在此输入 memory 内容…
`;

export function MemoryPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<MemoryTypeFilter>("all");
  const [selected, setSelected] = useState<MemoryEntry | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listMemories();
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  const filtered = filter === "all"
    ? entries
    : entries.filter((e) => e.memory_type === filter);

  function handleSelect(entry: MemoryEntry) {
    setSelected(entry);
    setEditContent(entry.content);
    setIsNew(false);
  }

  function handleNew() {
    setSelected(null);
    setIsNew(true);
    setNewFileName(`memory_${Date.now()}.md`);
    setEditContent(NEW_ENTRY_TEMPLATE);
    setSaveStatus("idle");
  }

  async function handleSave() {
    const fileName = isNew ? newFileName : selected?.file_name;
    if (!fileName) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      await api.writeMemory(fileName, editContent);
      setSaveStatus("saved");
      saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
      await load();
      // 保存后选中该条目
      setIsNew(false);
      setSelected(entries.find((e) => e.file_name === fileName) ?? null);
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: MemoryEntry) {
    if (!confirm(`确认删除 ${entry.name || entry.file_name}？`)) return;
    await api.deleteMemory(entry.file_name);
    setSelected(null);
    setIsNew(false);
    await load();
  }

  const isDirty = selected ? editContent !== selected.content : editContent !== NEW_ENTRY_TEMPLATE;

  return (
    <div className="h-full flex overflow-hidden">
      {/* 左栏：列表 */}
      <div
        className="flex flex-col overflow-hidden flex-shrink-0"
        style={{ width: "300px", borderRight: "1px solid var(--border)" }}
      >
        {/* 头部 */}
        <div
          className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
        >
          <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
            Memory ({filtered.length})
          </span>
          <button
            onClick={handleNew}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
            style={{ background: "var(--accent)", color: "white" }}
          >
            <Plus size={11} /> 新建
          </button>
        </div>

        {/* 类型过滤 */}
        <div
          className="px-3 py-2 border-b flex gap-1 flex-wrap flex-shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          <Filter size={11} style={{ color: "var(--text-tertiary)", alignSelf: "center", marginRight: 2 }} />
          {MEMORY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className="text-xs px-2 py-0.5 rounded-full transition-colors"
              style={{
                background: filter === t
                  ? (t === "all" ? "var(--accent)" : TYPE_COLORS[t]?.bg ?? "var(--surface-card)")
                  : "var(--surface-card)",
                color: filter === t
                  ? (t === "all" ? "white" : TYPE_COLORS[t]?.color ?? "var(--text-secondary)")
                  : "var(--text-secondary)",
                border: `1px solid ${filter === t ? "transparent" : "var(--border)"}`,
              }}
            >
              {t === "all" ? "全部" : TYPE_COLORS[t]?.label ?? t}
            </button>
          ))}
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <LoadingSkeleton count={3} height="h-14" className="px-2" />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <Brain size={24} style={{ color: "var(--text-tertiary)" }} />
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {filter === "all" ? "暂无 Memory" : `无 ${filter} 类型`}
              </p>
            </div>
          ) : (
            filtered.map((entry) => {
              const tc = TYPE_COLORS[entry.memory_type];
              const isActive = selected?.file_name === entry.file_name && !isNew;
              return (
                <button
                  key={entry.file_name}
                  onClick={() => handleSelect(entry)}
                  className="w-full text-left rounded-lg px-3 py-2.5 mb-1 transition-colors"
                  style={{
                    background: isActive ? "rgba(217,113,57,0.08)" : "transparent",
                    border: `1px solid ${isActive ? "rgba(217,113,57,0.2)" : "transparent"}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        background: tc?.bg ?? "var(--surface-2)",
                        color: tc?.color ?? "var(--text-tertiary)",
                        fontSize: "10px",
                      }}
                    >
                      {tc?.label ?? entry.memory_type}
                    </span>
                    <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {entry.name || entry.file_name}
                    </span>
                  </div>
                  {entry.description && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-tertiary)" }}>
                      {entry.description}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 右栏：编辑器 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isNew || selected ? (
          <>
            {/* 编辑器头部 */}
            <div
              className="px-5 py-3 border-b flex items-center gap-3 flex-shrink-0"
              style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
            >
              {isNew ? (
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="flex-1 text-sm px-3 py-1 rounded-lg outline-none font-mono"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="文件名.md"
                />
              ) : (
                <span className="flex-1 font-mono text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                  {selected?.file_name}
                </span>
              )}

              <SaveStatusBadge status={saveStatus} />

              {selected && !isNew && (
                <button
                  onClick={() => handleDelete(selected)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                  style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)" }}
                >
                  <Trash2 size={12} /> 删除
                </button>
              )}

              <button
                onClick={() => { setSelected(null); setIsNew(false); }}
                className="text-xs"
                style={{ color: "var(--text-tertiary)" }}
              >
                <X size={15} />
              </button>

              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                style={{
                  background: isDirty ? "var(--accent)" : "var(--surface-2)",
                  color: isDirty ? "white" : "var(--text-tertiary)",
                }}
              >
                <Save size={12} />
                {saving ? "保存中…" : "保存"}
              </button>
            </div>

            {/* Markdown 编辑器 */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 w-full resize-none outline-none font-mono text-sm p-5"
                style={{
                  background: "var(--editor-body)",
                  color: "var(--editor-text)",
                  lineHeight: "1.7",
                  fontSize: "13px",
                }}
                placeholder={NEW_ENTRY_TEMPLATE}
              />
            </div>

            {/* 底部状态栏 */}
            <div
              className="px-5 py-1.5 border-t font-mono text-xs flex gap-4"
              style={{ borderColor: "var(--border)", color: "var(--text-tertiary)", background: "var(--surface-2)" }}
            >
              <span>~/.claude/memory/{isNew ? newFileName : selected?.file_name}</span>
              <span className="flex-1" />
              {isDirty && (
                <span style={{ color: "var(--accent)" }}>未保存</span>
              )}
              <span>{editContent.length} 字符</span>
            </div>
          </>
        ) : (
          /* 空状态 */
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Brain size={40} style={{ color: "var(--text-tertiary)" }} />
            <div className="text-center">
              <p className="font-medium" style={{ color: "var(--text-secondary)" }}>选择一条 Memory 进行编辑</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
                或点击「新建」创建新的 Memory 条目
              </p>
            </div>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mt-2"
              style={{ background: "var(--accent)", color: "white" }}
            >
              <Plus size={14} /> 新建 Memory
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
