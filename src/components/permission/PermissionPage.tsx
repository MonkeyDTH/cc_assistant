import { useEffect, useState, useRef } from "react";
import { Shield, FolderOpen, Save, Plus, X, Check, Pencil } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { api } from "@/lib/tauri-api";
import { getProjectName } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { SaveStatusBadge } from "@/components/ui/SaveStatusBadge";
import type { Permissions, Settings } from "@/lib/types";

type RuleKind = "allow" | "deny" | "ask";

// ——— 单个规则 Block ———
interface PermissionBlockProps {
  kind: RuleKind;
  items: string[];
  onChange: (kind: RuleKind, items: string[]) => void;
}

const KIND_META: Record<RuleKind, { label: string; color: string; bg: string; border: string }> = {
  allow: { label: "允许", color: "#22c55e", bg: "#22c55e12", border: "#22c55e30" },
  deny:  { label: "拒绝", color: "#ef4444", bg: "#ef444412", border: "#ef444430" },
  ask:   { label: "询问", color: "#f59e0b", bg: "#f59e0b12", border: "#f59e0b30" },
};

function PermissionBlock({ kind, items, onChange }: PermissionBlockProps) {
  const meta = KIND_META[kind];
  // 新增输入框状态
  const [adding, setAdding] = useState(false);
  const [addValue, setAddValue] = useState("");
  // 编辑状态：editingIdx 为正在编辑的 index，editValue 为临时值
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    if (editingIdx !== null) editInputRef.current?.focus();
  }, [editingIdx]);

  function confirmAdd() {
    const v = addValue.trim();
    if (v && !items.includes(v)) onChange(kind, [...items, v]);
    setAddValue("");
    setAdding(false);
  }

  function cancelAdd() {
    setAddValue("");
    setAdding(false);
  }

  function startEdit(idx: number) {
    setEditingIdx(idx);
    setEditValue(items[idx]);
  }

  function confirmEdit() {
    if (editingIdx === null) return;
    const v = editValue.trim();
    if (v) {
      const next = [...items];
      next[editingIdx] = v;
      onChange(kind, next);
    }
    setEditingIdx(null);
  }

  function cancelEdit() {
    setEditingIdx(null);
  }

  function removeItem(idx: number) {
    onChange(kind, items.filter((_, i) => i !== idx));
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "var(--surface-card)",
        border: `1px solid var(--border)`,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Block 头部 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: meta.color }}
          />
          <span className="text-sm font-semibold" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-mono"
            style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
          >
            {items.length}
          </span>
        </div>
        <button
          onClick={() => { setAdding(true); setEditingIdx(null); }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
          title="新增规则"
        >
          <Plus size={13} /> 新增
        </button>
      </div>

      {/* 规则列表 */}
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) =>
          editingIdx === idx ? (
            // 编辑态
            <div
              key={idx}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5"
              style={{ background: meta.bg, border: `1px solid ${meta.color}` }}
            >
              <input
                ref={editInputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                className="font-mono text-sm outline-none bg-transparent"
                style={{ color: meta.color, minWidth: "100px", width: `${Math.max(editValue.length, 8)}ch` }}
              />
              <button onClick={confirmEdit} title="确认" style={{ color: meta.color }}>
                <Check size={14} />
              </button>
              <button onClick={cancelEdit} title="取消" style={{ color: "var(--text-tertiary)" }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            // 展示态
            <div
              key={idx}
              className="group flex items-center gap-1.5 rounded-md px-3 py-1.5"
              style={{
                background: meta.bg,
                border: `1px solid ${meta.border}`,
                fontSize: "13px",
              }}
            >
              <span className="font-mono" style={{ color: meta.color }}>{item}</span>
              <button
                onClick={() => startEdit(idx)}
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                style={{ color: meta.color }}
                title="编辑"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => removeItem(idx)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "#ef4444" }}
                title="删除"
              >
                <X size={12} />
              </button>
            </div>
          )
        )}

        {/* 新增输入框 */}
        {adding && (
          <div
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5"
            style={{ background: meta.bg, border: `1px solid ${meta.color}` }}
          >
            <input
              ref={addInputRef}
              value={addValue}
              onChange={(e) => setAddValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmAdd();
                if (e.key === "Escape") cancelAdd();
              }}
              placeholder="输入规则…"
              className="font-mono text-sm outline-none bg-transparent"
              style={{ color: meta.color, minWidth: "140px" }}
            />
            <button onClick={confirmAdd} title="确认" style={{ color: meta.color }}>
              <Check size={14} />
            </button>
            <button onClick={cancelAdd} title="取消" style={{ color: "var(--text-tertiary)" }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* 空态提示 */}
        {items.length === 0 && !adding && (
          <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            暂无规则，点击「新增」添加
          </span>
        )}
      </div>
    </div>
  );
}

// ——— 三个 Block 的容器 ———
interface PermissionEditorProps {
  perms: Permissions;
  onChange: (perms: Permissions) => void;
}

function PermissionEditor({ perms, onChange }: PermissionEditorProps) {
  function handleChange(kind: RuleKind, items: string[]) {
    onChange({ ...perms, [kind]: items });
  }

  return (
    <div className="flex flex-col gap-4">
      <PermissionBlock kind="allow" items={perms.allow ?? []} onChange={handleChange} />
      <PermissionBlock kind="deny"  items={perms.deny  ?? []} onChange={handleChange} />
      <PermissionBlock kind="ask"   items={perms.ask   ?? []} onChange={handleChange} />
    </div>
  );
}

// ——— 主页面 ———
type TabType = "global" | "project";

export function PermissionPage() {
  const [tab, setTab] = useState<TabType>("global");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header
        className="px-6 py-3 border-b flex items-center gap-3 flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        <h1 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>权限规则</h1>
        <div style={{ width: "1px", height: "18px", background: "var(--border)" }} />
        {(["global", "project"] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: tab === t ? "var(--accent)" : "transparent",
              color: tab === t ? "white" : "var(--text-secondary)",
            }}
          >
            {t === "global" ? <Shield size={12} /> : <FolderOpen size={12} />}
            {t === "global" ? "全局" : "项目级"}
          </button>
        ))}
      </header>

      <div className="flex-1 overflow-hidden">
        {tab === "global" ? <GlobalPermissionSettings /> : <ProjectPermissionSettings />}
      </div>
    </div>
  );
}

// ——— 全局权限设置 ———
function GlobalPermissionSettings() {
  const { settings, fetchSettings, updateSettings, settingsLoading } = useAppStore();
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => {
    if (settings && localSettings === null) setLocalSettings(settings);
  }, [settings, localSettings]);

  async function handleSave() {
    if (!localSettings) return;
    try {
      await updateSettings(localSettings);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    }
  }

  function handlePermsChange(perms: Permissions) {
    setLocalSettings((prev) => prev ? { ...prev, permissions: perms } : prev);
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {settingsLoading ? (
          <LoadingSkeleton count={3} height="h-24" />
        ) : localSettings ? (
          <PermissionEditor
            perms={localSettings.permissions ?? {}}
            onChange={handlePermsChange}
          />
        ) : null}
      </div>

      <div
        className="px-8 py-3 border-t flex items-center justify-end gap-3"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <SaveStatusBadge status={saveStatus} />
        <button
          onClick={handleSave}
          disabled={!localSettings}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
          style={{ background: "var(--accent)", color: "white" }}
        >
          <Save size={14} /> 保存全局权限
        </button>
      </div>
    </div>
  );
}

// ——— 项目级权限设置 ———
function ProjectPermissionSettings() {
  const { projects } = useAppStore();
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const [perms, setPerms] = useState<Permissions>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    api.readProjectSettings(selectedProject.path)
      .then((s) => setPerms(s.permissions ?? {}))
      .finally(() => setLoading(false));
  }, [selectedProject?.path]);

  async function handleSave() {
    if (!selectedProject) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      const full = await api.readProjectSettings(selectedProject.path);
      await api.writeProjectSettings(selectedProject.path, { ...full, permissions: perms });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 项目选择 */}
      <div
        className="px-8 py-3 border-b flex items-center gap-3 flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>项目</span>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="flex-1 text-sm px-3 py-1.5 rounded-lg outline-none"
          style={{
            background: "var(--surface-card)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            fontFamily: "inherit",
          }}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {getProjectName(p.path)} — {p.path}
            </option>
          ))}
        </select>
      </div>

      {/* 权限编辑 */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <LoadingSkeleton count={3} height="h-24" />
        ) : (
          <PermissionEditor perms={perms} onChange={setPerms} />
        )}
      </div>

      <div
        className="px-8 py-3 border-t flex items-center justify-end gap-3"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <SaveStatusBadge status={saveStatus} />
        <button
          onClick={handleSave}
          disabled={saving || !selectedProject}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
          style={{ background: "var(--accent)", color: "white" }}
        >
          <Save size={14} /> {saving ? "保存中…" : "保存项目权限"}
        </button>
      </div>
    </div>
  );
}
