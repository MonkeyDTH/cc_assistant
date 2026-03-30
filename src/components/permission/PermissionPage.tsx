import { useEffect, useState } from "react";
import { Shield, FolderOpen, Save } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { api } from "@/lib/tauri-api";
import { getProjectName } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { SaveStatusBadge } from "@/components/ui/SaveStatusBadge";
import type { Permissions, Settings } from "@/lib/types";

type Tab = "global" | "project";

export function PermissionPage() {
  const [tab, setTab] = useState<Tab>("global");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header
        className="px-6 py-3 border-b flex items-center gap-3 flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        <h1 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>权限规则</h1>
        <div style={{ width: "1px", height: "18px", background: "var(--border)" }} />
        {(["global", "project"] as Tab[]).map((t) => (
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

  const perms = localSettings?.permissions;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {settingsLoading ? (
          <LoadingSkeleton count={3} height="h-24" />
        ) : (
          <div className="rounded-xl p-5" style={{ background: "var(--surface-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center gap-2 mb-4">
              <span style={{ color: "var(--accent)" }}><Shield size={15} /></span>
              <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>权限规则</h2>
            </div>
            {perms && (perms.allow?.length || perms.deny?.length || perms.ask?.length) ? (
              <>
                <PermissionList label="允许" items={perms.allow ?? []} color="#22c55e" />
                <PermissionList label="拒绝" items={perms.deny ?? []} color="#ef4444" />
                <PermissionList label="询问" items={perms.ask ?? []} color="#f59e0b" />
              </>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>暂无权限规则</p>
            )}
          </div>
        )}
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

function ProjectPermissionSettings() {
  const { projects } = useAppStore();
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const [perms, setPerms] = useState<Permissions | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    api.readProjectSettings(selectedProject.path)
      .then((s) => setPerms(s.permissions))
      .finally(() => setLoading(false));
  }, [selectedProject?.path]);

  async function handleSave() {
    if (!selectedProject) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      // 读取完整设置后只修改 permissions 字段
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
      <div className="px-8 py-3 border-b flex items-center gap-3 flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>项目</span>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="flex-1 text-sm px-3 py-1.5 rounded-lg outline-none"
          style={{ background: "var(--surface-card)", border: "1px solid var(--border)", color: "var(--text-primary)", fontFamily: "inherit" }}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{getProjectName(p.path)} — {p.path}</option>
          ))}
        </select>
      </div>

      {/* 权限展示 */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <LoadingSkeleton count={3} height="h-16" />
        ) : (
          <div className="rounded-xl p-5" style={{ background: "var(--surface-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center gap-2 mb-4">
              <span style={{ color: "var(--accent)" }}><Shield size={15} /></span>
              <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>项目权限规则</h2>
            </div>
            {perms && (perms.allow?.length || perms.deny?.length || perms.ask?.length) ? (
              <>
                <PermissionList label="允许" items={perms.allow ?? []} color="#22c55e" />
                <PermissionList label="拒绝" items={perms.deny ?? []} color="#ef4444" />
                <PermissionList label="询问" items={perms.ask ?? []} color="#f59e0b" />
              </>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>暂无权限规则</p>
            )}
          </div>
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

function PermissionList({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="text-xs font-medium mb-2" style={{ color }}>{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="font-mono text-xs px-2 py-1 rounded-md"
            style={{ background: `${color}15`, color, border: `1px solid ${color}30`, fontSize: "11px" }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
