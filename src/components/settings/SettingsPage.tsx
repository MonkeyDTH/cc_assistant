import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Shield, Cpu, FolderOpen, Save } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { api } from "@/lib/tauri-api";
import { getProjectName } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { SaveStatusBadge } from "@/components/ui/SaveStatusBadge";
import type { Settings } from "@/lib/types";

const MODELS = [
  { id: "opus[1m]",   label: "Claude Opus 4.6 (1M)" },
  { id: "sonnet[1m]", label: "Claude Sonnet 4.6 (1M)" },
  { id: "sonnet",     label: "Claude Sonnet 4.6" },
  { id: "haiku",      label: "Claude Haiku 4.5" },
];

type Tab = "global" | "project";

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("global");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header
        className="px-6 py-3 border-b flex items-center gap-3 flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        <h1 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>设置</h1>
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
            {t === "global" ? <SettingsIcon size={12} /> : <FolderOpen size={12} />}
            {t === "global" ? "全局" : "项目级"}
          </button>
        ))}
      </header>

      <div className="flex-1 overflow-hidden">
        {tab === "global" ? <GlobalSettings /> : <ProjectSettings />}
      </div>
    </div>
  );
}

function GlobalSettings() {
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

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
        {settingsLoading ? (
          <LoadingSkeleton count={3} height="h-24" />
        ) : (
          <>
            <Section icon={<Cpu size={15} />} title="默认模型">
              <div className="grid grid-cols-3 gap-3">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => localSettings && setLocalSettings({ ...localSettings, model: m.id })}
                    className="rounded-lg px-4 py-3 text-left transition-all"
                    style={{
                      background: localSettings?.model === m.id ? "rgba(217,113,57,0.1)" : "var(--surface-2)",
                      border: `1px solid ${localSettings?.model === m.id ? "rgba(217,113,57,0.3)" : "var(--border)"}`,
                      color: localSettings?.model === m.id ? "var(--accent)" : "var(--text-primary)",
                    }}
                  >
                    <div className="font-mono text-xs font-medium">{m.id}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{m.label}</div>
                  </button>
                ))}
              </div>
            </Section>


            <Section icon={<Shield size={15} />} title="权限规则">
              <PermissionList label="允许" items={localSettings?.permissions?.allow ?? []} color="#22c55e" />
              <PermissionList label="拒绝" items={localSettings?.permissions?.deny ?? []} color="#ef4444" />
              <PermissionList label="询问" items={localSettings?.permissions?.ask ?? []} color="#f59e0b" />
            </Section>
          </>
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
          <Save size={14} /> 保存全局设置
        </button>
      </div>
    </div>
  );
}

function ProjectSettings() {
  const { projects } = useAppStore();
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [rawJson, setRawJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    api.readProjectSettings(selectedProject.path)
      .then((s) => {
        setSettings(s);
        setRawJson(JSON.stringify(s, null, 2));
        setJsonError(null);
      })
      .finally(() => setLoading(false));
  }, [selectedProject?.path]);

  function handleJsonChange(val: string) {
    setRawJson(val);
    try {
      setSettings(JSON.parse(val));
      setJsonError(null);
    } catch {
      setJsonError("JSON 格式错误");
    }
  }

  async function handleSave() {
    if (!selectedProject || !settings || jsonError) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      await api.writeProjectSettings(selectedProject.path, settings);
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

      {/* JSON 编辑器 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="p-8"><LoadingSkeleton count={3} height="h-16" /></div>
        ) : (
          <textarea
            value={rawJson}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="flex-1 w-full resize-none outline-none font-mono text-sm p-5"
            style={{
              background: "var(--editor-body)",
              color: jsonError ? "#ef4444" : "var(--editor-text)",
              lineHeight: "1.7",
              fontSize: "13px",
            }}
            placeholder="{}"
            spellCheck={false}
          />
        )}
      </div>

      {/* 底部 */}
      <div
        className="px-8 py-3 border-t flex items-center gap-3"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <span className="font-mono text-xs flex-1" style={{ color: jsonError ? "#ef4444" : "var(--text-tertiary)" }}>
          {jsonError ?? (selectedProject ? `${selectedProject.path.replace(/\\/g, "/")}/.claude/settings.json` : "")}
        </span>
        <SaveStatusBadge status={saveStatus} />
        <button
          onClick={handleSave}
          disabled={saving || !!jsonError || !selectedProject}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
          style={{ background: "var(--accent)", color: "white" }}
        >
          <Save size={14} /> {saving ? "保存中…" : "保存项目设置"}
        </button>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--surface-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center gap-2 mb-4">
        <span style={{ color: "var(--accent)" }}>{icon}</span>
        <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{title}</h2>
      </div>
      {children}
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
