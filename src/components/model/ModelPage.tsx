import { useEffect, useState } from "react";
import { Cpu, FolderOpen, Globe, Terminal, Monitor, Check, X, Save, AlertCircle, KeyRound, Link, ChevronDown, Zap, Hash } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { api } from "@/lib/tauri-api";
import { getProjectName } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { SaveStatusBadge } from "@/components/ui/SaveStatusBadge";
import type { Settings } from "@/lib/types";

// Claude Code 读取的三个模型默认值环境变量，及对应的别名（别名才是 settings.json model 字段的有效值）
const MODEL_ENV_KEYS = [
  { key: "ANTHROPIC_DEFAULT_OPUS_MODEL",   aliases: ["opus[1m]", "opus"] },
  { key: "ANTHROPIC_DEFAULT_SONNET_MODEL", aliases: ["sonnet[1m]", "sonnet"] },
  { key: "ANTHROPIC_DEFAULT_HAIKU_MODEL",  aliases: ["haiku"] },
  { key: "ANTHROPIC_MODEL",               aliases: [] },  // 强制覆盖，不提供别名建议
];

type ModelEnvVars = Record<string, string>;

export function ModelPage() {
  const { settings, fetchSettings, updateSettings, settingsLoading, projects, profilesConfig, fetchProfiles, switchProfile, setActiveNav } = useAppStore();

  // 全局 settings（本地副本）
  const [globalSettings, setGlobalSettings] = useState<Settings | null>(null);
  // 从系统读到的 env vars（只读）
  const [envVars, setEnvVars] = useState<ModelEnvVars | null>(null);
  const [envLoading, setEnvLoading] = useState(true);
  // API 相关环境变量（只读展示）
  const [apiEnvVars, setApiEnvVars] = useState<{ baseUrl: string; apiKey: string }>({ baseUrl: "", apiKey: "" });

  // 项目选择
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const [projectSettings, setProjectSettings] = useState<Settings | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);

  // 三个可编辑来源的草稿值
  const [envModelDraft, setEnvModelDraft]       = useState<string>("");  // settings.env.ANTHROPIC_MODEL
  const [projectModelDraft, setProjectModelDraft] = useState<string>("");
  const [globalModelDraft, setGlobalModelDraft]   = useState<string>("");

  // 保存状态
  const [envSaveStatus,     setEnvSaveStatus]     = useState<"idle" | "saved" | "error">("idle");
  const [projectSaveStatus, setProjectSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [globalSaveStatus,  setGlobalSaveStatus]  = useState<"idle" | "saved" | "error">("idle");

  // Profile 快捷切换状态
  const [profileDropOpen, setProfileDropOpen] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // "保存当前配置为 Profile" 内联表单
  const [savingAsProfile, setSavingAsProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // 加载全局 settings 和 profiles
  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);
  useEffect(() => {
    if (settings && globalSettings === null) {
      setGlobalSettings(settings);
      setEnvModelDraft(settings.env?.ANTHROPIC_MODEL ?? "");
      setGlobalModelDraft(settings.model ?? "");
    }
  }, [settings, globalSettings]);

  // 读取系统环境变量
  useEffect(() => {
    setEnvLoading(true);
    const modelKeys = MODEL_ENV_KEYS.map((m) => m.key);
    const apiKeys = ["ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY"];
    api.getEnvVars([...modelKeys, ...apiKeys])
      .then((vars) => {
        // 分别存入不同状态
        const modelVars: ModelEnvVars = {};
        for (const k of modelKeys) { if (vars[k]) modelVars[k] = vars[k]; }
        setEnvVars(modelVars);
        setApiEnvVars({
          baseUrl: vars["ANTHROPIC_BASE_URL"] ?? "",
          apiKey:  vars["ANTHROPIC_API_KEY"]  ?? "",
        });
      })
      .finally(() => setEnvLoading(false));
  }, []);

  // 加载项目 settings
  useEffect(() => {
    if (!selectedProject) return;
    setProjectLoading(true);
    setProjectSettings(null);
    setProjectModelDraft("");
    api.readProjectSettings(selectedProject.path)
      .then((s) => {
        setProjectSettings(s);
        setProjectModelDraft(s.model ?? "");
      })
      .finally(() => setProjectLoading(false));
  }, [selectedProject?.path]);

  // 计算当前生效的模型（优先级：ANTHROPIC_MODEL env > settings.env > project model > global model）
  const sysAnthropicModel = envVars?.ANTHROPIC_MODEL ?? "";
  const effectiveModel =
    sysAnthropicModel.trim()  ? sysAnthropicModel :
    envModelDraft.trim()      ? envModelDraft :
    projectModelDraft.trim()  ? projectModelDraft :
    globalModelDraft.trim()   ? globalModelDraft : "";

  const effectiveSource =
    sysAnthropicModel.trim()  ? "sys-env" :
    envModelDraft.trim()      ? "settings-env" :
    projectModelDraft.trim()  ? "project" :
    globalModelDraft.trim()   ? "global" : "none";

  // 从系统 env vars 构建参考表（别名 → 实际 model ID）
  const modelMappings = MODEL_ENV_KEYS
    .filter((m) => m.aliases.length > 0 && envVars?.[m.key])
    .map((m) => ({ key: m.key, modelId: envVars![m.key], aliases: m.aliases }));

  // datalist 建议使用别名（这才是 settings.json model 字段的有效值）
  const aliasSuggestions = modelMappings.flatMap((m) => m.aliases);

  // 保存：settings.env.ANTHROPIC_MODEL
  async function saveEnv() {
    if (!globalSettings) return;
    try {
      const newEnv = { ...(globalSettings.env ?? {}) };
      if (envModelDraft.trim()) {
        newEnv.ANTHROPIC_MODEL = envModelDraft.trim();
      } else {
        delete (newEnv as Record<string, string | undefined>).ANTHROPIC_MODEL;
      }
      const updated = { ...globalSettings, env: newEnv };
      await updateSettings(updated);
      setGlobalSettings(updated);
      setEnvSaveStatus("saved");
      setTimeout(() => setEnvSaveStatus("idle"), 3000);
    } catch {
      setEnvSaveStatus("error");
    }
  }

  // 保存：项目 model
  async function saveProject() {
    if (!selectedProject || !projectSettings) return;
    try {
      const updated: Settings = { ...projectSettings };
      if (projectModelDraft.trim()) updated.model = projectModelDraft.trim();
      else delete updated.model;
      await api.writeProjectSettings(selectedProject.path, updated);
      setProjectSettings(updated);
      setProjectSaveStatus("saved");
      setTimeout(() => setProjectSaveStatus("idle"), 3000);
    } catch {
      setProjectSaveStatus("error");
    }
  }

  // 保存：全局 model
  async function saveGlobal() {
    if (!globalSettings) return;
    try {
      const updated: Settings = { ...globalSettings };
      if (globalModelDraft.trim()) updated.model = globalModelDraft.trim();
      else delete updated.model;
      await updateSettings(updated);
      setGlobalSettings(updated);
      setGlobalSaveStatus("saved");
      setTimeout(() => setGlobalSaveStatus("idle"), 3000);
    } catch {
      setGlobalSaveStatus("error");
    }
  }

  // 将当前环境配置保存为新 Profile
  async function saveCurrentAsProfile() {
    if (!newProfileName.trim()) return;
    setSavingProfile(true);
    try {
      const newProfile = {
        id: crypto.randomUUID(),
        name: newProfileName.trim(),
        apiKey: apiEnvVars.apiKey,
        baseUrl: apiEnvVars.baseUrl,
        models: {
          opus:   envVars?.ANTHROPIC_DEFAULT_OPUS_MODEL   ?? "",
          sonnet: envVars?.ANTHROPIC_DEFAULT_SONNET_MODEL ?? "",
          haiku:  envVars?.ANTHROPIC_DEFAULT_HAIKU_MODEL  ?? "",
        },
      };
      const current = profilesConfig ?? { activeProfileId: null, profiles: [] };
      await (useAppStore.getState().saveProfiles)({
        ...current,
        profiles: [...current.profiles, newProfile],
      });
      setNewProfileName("");
      setSavingAsProfile(false);
    } finally {
      setSavingProfile(false);
    }
  }

  if (settingsLoading || envLoading) {
    return <div className="h-full px-8 py-6"><LoadingSkeleton count={4} height="h-28" /></div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 顶栏 */}
      <header
        className="px-6 py-3 border-b flex items-center gap-3 flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        <Cpu size={15} style={{ color: "var(--accent)" }} />
        <h1 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>模型配置</h1>
        <div style={{ width: "1px", height: "18px", background: "var(--border)" }} />
        <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "rgba(217,113,57,0.12)", color: "var(--accent)" }}>
          {effectiveModel || "未配置"}
        </span>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {effectiveSource === "sys-env"      && "来自系统 ANTHROPIC_MODEL"}
          {effectiveSource === "settings-env" && "来自 settings.json → env.ANTHROPIC_MODEL"}
          {effectiveSource === "project"      && "来自项目 settings.json"}
          {effectiveSource === "global"       && "来自全局 settings.json"}
          {effectiveSource === "none"         && "使用 Claude Code 默认"}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-3">
        <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
          以下来源按优先级从高到低排列，高优先级非空时覆盖低优先级。
        </p>

        {/* ── 来源 0：系统 ANTHROPIC_MODEL（只读）── */}
        <ReadOnlyCard
          priority={1}
          icon={<Monitor size={14} />}
          label="系统环境变量"
          path="ANTHROPIC_MODEL（Windows 用户变量）"
          active={effectiveSource === "sys-env"}
          value={envVars?.ANTHROPIC_MODEL}
          emptyHint="未设置，不覆盖"
        />

        {/* ── 来源 1：settings.env.ANTHROPIC_MODEL（可编辑）── */}
        <EditableCard
          priority={2}
          icon={<Terminal size={14} />}
          label="配置文件环境变量"
          path="~/.claude/settings.json → env.ANTHROPIC_MODEL"
          active={effectiveSource === "settings-env"}
          saveStatus={envSaveStatus}
          onSave={saveEnv}
        >
          <ModelInput value={envModelDraft} onChange={setEnvModelDraft} suggestions={aliasSuggestions} placeholder="留空则不覆盖" />
        </EditableCard>

        {/* ── 来源 2：项目 model（可编辑）── */}
        <EditableCard
          priority={3}
          icon={<FolderOpen size={14} />}
          label="项目配置"
          path={selectedProject ? `${selectedProject.path.replace(/\\/g, "/")}/.claude/settings.json → model` : ".claude/settings.json → model"}
          active={effectiveSource === "project"}
          saveStatus={projectSaveStatus}
          onSave={saveProject}
          extra={
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-xs px-2 py-1 rounded-lg outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontFamily: "inherit" }}
            >
              {projects.map((p) => <option key={p.id} value={p.id}>{getProjectName(p.path)}</option>)}
            </select>
          }
        >
          {projectLoading
            ? <div className="h-9 rounded-lg animate-pulse" style={{ background: "var(--surface-2)" }} />
            : <ModelInput value={projectModelDraft} onChange={setProjectModelDraft} suggestions={aliasSuggestions} placeholder="留空则继承全局配置" />
          }
        </EditableCard>

        {/* ── 来源 3：全局 model（可编辑）── */}
        <EditableCard
          priority={4}
          icon={<Globe size={14} />}
          label="全局配置"
          path="~/.claude/settings.json → model"
          active={effectiveSource === "global"}
          saveStatus={globalSaveStatus}
          onSave={saveGlobal}
        >
          <ModelInput value={globalModelDraft} onChange={setGlobalModelDraft} suggestions={aliasSuggestions} placeholder="留空则使用 Claude Code 默认" />
        </EditableCard>

        {/* ── 参考：别名 → 实际 Model ID 映射表 ── */}
        {modelMappings.length > 0 && (
          <div className="rounded-xl p-5 mt-2"
            style={{ background: "var(--surface-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Monitor size={13} style={{ color: "var(--text-tertiary)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                可用别名（settings.json model 字段应填写这些值）
              </span>
            </div>
            <div className="space-y-2">
              {modelMappings.map(({ key, modelId, aliases }) => (
                <div key={key} className="flex items-center gap-3 flex-wrap">
                  <div className="flex gap-1.5">
                    {aliases.map((alias) => (
                      <span key={alias} className="font-mono text-xs px-2 py-0.5 rounded font-medium"
                        style={{ background: "rgba(217,113,57,0.1)", color: "var(--accent)", border: "1px solid rgba(217,113,57,0.2)" }}>
                        {alias}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>→</span>
                  <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{modelId}</span>
                  <span className="font-mono text-xs" style={{ color: "var(--text-tertiary)" }}>({key})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {modelMappings.length === 0 && (
          <div className="flex items-center gap-2 text-xs px-1" style={{ color: "var(--text-tertiary)" }}>
            <AlertCircle size={12} />
            未检测到 ANTHROPIC_DEFAULT_*_MODEL 环境变量，输入框将不提供自动补全建议
          </div>
        )}

        {/* ── 当前激活 Profile（API Key / 端点 / 模型 ID）── */}
        {(() => {
          const activeProfile = profilesConfig?.profiles.find(
            (p) => p.id === profilesConfig.activeProfileId
          ) ?? null;
          const profiles = profilesConfig?.profiles ?? [];

          return (
            <div className="rounded-xl p-5"
              style={{ background: "var(--surface-card)", border: "1px solid var(--border)" }}>
              {/* 标题行 */}
              <div className="flex items-center gap-2 mb-4">
                <KeyRound size={13} style={{ color: "var(--text-tertiary)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  API Profile
                </span>
                {activeProfile && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(217,113,57,0.12)", color: "var(--accent)" }}>
                    <Check size={10} /> {activeProfile.name}
                  </span>
                )}
                {/* 快捷切换下拉 */}
                <div className="ml-auto relative">
                  <button
                    onClick={() => setProfileDropOpen((v) => !v)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs"
                    style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  >
                    <Zap size={11} /> 切换
                    <ChevronDown size={10} style={{ opacity: 0.6 }} />
                  </button>
                  {profileDropOpen && (
                    <div
                      className="absolute right-0 top-full mt-1 rounded-lg py-1 z-50 min-w-36"
                      style={{ background: "var(--surface-card)", border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
                      onMouseLeave={() => setProfileDropOpen(false)}
                    >
                      {profiles.length === 0 && (
                        <div className="px-3 py-2 text-xs" style={{ color: "var(--text-tertiary)" }}>暂无 profiles</div>
                      )}
                      {profiles.map((p) => {
                        const isCurrent = p.id === profilesConfig?.activeProfileId;
                        return (
                          <button key={p.id}
                            onClick={async () => {
                              if (!isCurrent) {
                                setActivatingId(p.id);
                                try { await switchProfile(p.id); } finally { setActivatingId(null); }
                              }
                              setProfileDropOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs"
                            style={{ color: isCurrent ? "var(--accent)" : "var(--text-primary)", opacity: activatingId === p.id ? 0.6 : 1 }}
                          >
                            <span className="flex-1 text-left truncate">{p.name}</span>
                            {isCurrent && <Check size={10} />}
                          </button>
                        );
                      })}
                      <div className="mx-2 my-1" style={{ height: "1px", background: "var(--border)" }} />
                      <button
                        onClick={() => { setActiveNav("profiles"); setProfileDropOpen(false); }}
                        className="w-full px-3 py-2 text-left text-xs"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        管理 Profiles…
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {activeProfile ? (
                <div className="space-y-2">
                  {/* API Key */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <KeyRound size={11} style={{ color: "var(--text-tertiary)" }} />
                      <span className="font-mono text-xs" style={{ color: "var(--text-tertiary)" }}>ANTHROPIC_API_KEY</span>
                    </div>
                    <div className="font-mono text-xs px-3 py-2 rounded-lg"
                      style={{ background: "var(--surface-2)", color: activeProfile.apiKey ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                      {activeProfile.apiKey
                        ? `${activeProfile.apiKey.slice(0, 8)}${"•".repeat(Math.max(0, activeProfile.apiKey.length - 12))}${activeProfile.apiKey.slice(-4)}`
                        : "未设置"}
                    </div>
                  </div>
                  {/* Base URL */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Link size={11} style={{ color: "var(--text-tertiary)" }} />
                      <span className="font-mono text-xs" style={{ color: "var(--text-tertiary)" }}>ANTHROPIC_BASE_URL</span>
                    </div>
                    <div className="font-mono text-xs px-3 py-2 rounded-lg truncate"
                      style={{ background: "var(--surface-2)", color: activeProfile.baseUrl ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                      {activeProfile.baseUrl || "https://api.anthropic.com（默认）"}
                    </div>
                  </div>
                  {/* 模型 IDs */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {(["opus", "sonnet", "haiku"] as const).map((tier) => (
                      <div key={tier}>
                        <div className="text-xs mb-1 capitalize" style={{ color: "var(--text-tertiary)" }}>{tier}</div>
                        <div className="font-mono text-xs px-2 py-1.5 rounded-lg truncate"
                          style={{ background: "var(--surface-2)", color: activeProfile.models[tier] ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                          {activeProfile.models[tier] || "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 自定义请求头 */}
                  {Object.keys(activeProfile.customHeaders ?? {}).length > 0 && (
                    <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                      <div className="flex items-center gap-1 text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
                        <Hash size={11} />
                        <span>自定义请求头（{Object.keys(activeProfile.customHeaders!).length} 项）</span>
                      </div>
                      <div className="space-y-1">
                        {Object.entries(activeProfile.customHeaders!).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2 font-mono text-xs">
                            <span className="px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--surface-2)", color: "var(--accent)" }}>{k}</span>
                            <span className="truncate" style={{ color: "var(--text-secondary)" }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 将当前环境变量配置另存为新 Profile */}
                  <div className="pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>
                      从系统环境变量另存为新 Profile：
                    </p>
                    <SaveAsProfileInline
                      open={savingAsProfile}
                      name={newProfileName}
                      saving={savingProfile}
                      onOpen={() => setSavingAsProfile(true)}
                      onCancel={() => { setSavingAsProfile(false); setNewProfileName(""); }}
                      onNameChange={setNewProfileName}
                      onSave={saveCurrentAsProfile}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
                    未激活任何 Profile，显示系统环境变量（只读）
                  </p>
                  {/* 系统 env 兜底展示 */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <KeyRound size={11} style={{ color: "var(--text-tertiary)" }} />
                      <span className="font-mono text-xs" style={{ color: "var(--text-tertiary)" }}>ANTHROPIC_API_KEY</span>
                    </div>
                    <div className="font-mono text-xs px-3 py-2 rounded-lg"
                      style={{ background: "var(--surface-2)", color: apiEnvVars.apiKey ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                      {apiEnvVars.apiKey
                        ? `${apiEnvVars.apiKey.slice(0, 8)}${"•".repeat(Math.max(0, apiEnvVars.apiKey.length - 12))}${apiEnvVars.apiKey.slice(-4)}`
                        : "未设置"}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Link size={11} style={{ color: "var(--text-tertiary)" }} />
                      <span className="font-mono text-xs" style={{ color: "var(--text-tertiary)" }}>ANTHROPIC_BASE_URL</span>
                    </div>
                    <div className="font-mono text-xs px-3 py-2 rounded-lg truncate"
                      style={{ background: "var(--surface-2)", color: apiEnvVars.baseUrl ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                      {apiEnvVars.baseUrl || "未设置（使用默认 https://api.anthropic.com）"}
                    </div>
                  </div>
                  <SaveAsProfileInline
                    open={savingAsProfile}
                    name={newProfileName}
                    saving={savingProfile}
                    onOpen={() => setSavingAsProfile(true)}
                    onCancel={() => { setSavingAsProfile(false); setNewProfileName(""); }}
                    onNameChange={setNewProfileName}
                    onSave={saveCurrentAsProfile}
                  />
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── 只读卡片（系统环境变量）──
function ReadOnlyCard({ priority, icon, label, path, active, value, emptyHint }: {
  priority: number; icon: React.ReactNode; label: string; path: string;
  active: boolean; value: string | undefined; emptyHint: string;
}) {
  return (
    <div className="rounded-xl p-5"
      style={{
        background: "var(--surface-card)",
        border: `1px solid ${active ? "rgba(217,113,57,0.4)" : "var(--border)"}`,
        boxShadow: active ? "0 0 0 1px rgba(217,113,57,0.15)" : "var(--shadow-sm)",
        opacity: value ? 1 : 0.6,
      }}>
      <CardHeader priority={priority} icon={icon} label={label} active={active}>
        <span className="text-xs px-2 py-0.5 rounded ml-auto" style={{ background: "var(--surface-2)", color: "var(--text-tertiary)" }}>只读</span>
      </CardHeader>
      <div className="font-mono text-xs mb-3 truncate" style={{ color: "var(--text-tertiary)" }}>{path}</div>
      <div className="font-mono text-sm px-3 py-2 rounded-lg"
        style={{ background: "var(--surface-2)", color: value ? "var(--text-primary)" : "var(--text-tertiary)" }}>
        {value || emptyHint}
      </div>
    </div>
  );
}

// ── 可编辑卡片 ──
function EditableCard({ priority, icon, label, path, active, saveStatus, onSave, extra, children }: {
  priority: number; icon: React.ReactNode; label: string; path: string;
  active: boolean; saveStatus: "idle" | "saved" | "error"; onSave: () => void;
  extra?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-5"
      style={{
        background: "var(--surface-card)",
        border: `1px solid ${active ? "rgba(217,113,57,0.4)" : "var(--border)"}`,
        boxShadow: active ? "0 0 0 1px rgba(217,113,57,0.15)" : "var(--shadow-sm)",
      }}>
      <CardHeader priority={priority} icon={icon} label={label} active={active}>
        {extra && <span className="ml-auto">{extra}</span>}
      </CardHeader>
      <div className="font-mono text-xs mb-3 truncate" style={{ color: "var(--text-tertiary)" }}>{path}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1">{children}</div>
        <SaveStatusBadge status={saveStatus} />
        <button onClick={onSave}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium flex-shrink-0"
          style={{ background: "var(--accent)", color: "white" }}>
          <Save size={12} /> 保存
        </button>
      </div>
    </div>
  );
}

// ── 卡片标题行 ──
function CardHeader({ priority, icon, label, active, children }: {
  priority: number; icon: React.ReactNode; label: string; active: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: active ? "var(--accent)" : "var(--surface-2)", color: active ? "white" : "var(--text-tertiary)" }}>
        {priority}
      </span>
      <span style={{ color: "var(--accent)" }}>{icon}</span>
      <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{label}</span>
      {active && (
        <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ background: "rgba(217,113,57,0.12)", color: "var(--accent)" }}>
          <Check size={10} /> 当前生效
        </span>
      )}
      {children}
    </div>
  );
}

// ── 将当前环境配置保存为 Profile 的内联表单 ──
function SaveAsProfileInline({
  open, name, saving, onOpen, onCancel, onNameChange, onSave,
}: {
  open: boolean;
  name: string;
  saving: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onNameChange: (v: string) => void;
  onSave: () => void;
}) {
  if (!open) {
    return (
      <button
        onClick={onOpen}
        className="text-xs px-3 py-1.5 rounded-lg"
        style={{ background: "rgba(217,113,57,0.1)", color: "var(--accent)", border: "1px solid rgba(217,113,57,0.2)" }}
      >
        保存当前配置为 Profile…
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
        placeholder="为这套配置起个名字"
        className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
      />
      <button
        onClick={onSave}
        disabled={saving || !name.trim()}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
        style={{ background: "var(--accent)", color: "white", opacity: saving || !name.trim() ? 0.6 : 1 }}
      >
        <Save size={11} /> {saving ? "…" : "保存"}
      </button>
      <button
        onClick={onCancel}
        className="p-1.5 rounded-lg"
        style={{ color: "var(--text-tertiary)", background: "var(--surface-2)" }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── 模型输入框（datalist 建议为别名，不是完整 model ID）──
function ModelInput({ value, onChange, suggestions, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
}) {
  const listId = "model-datalist";
  return (
    <div className="relative">
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none pr-8"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
      />
      <datalist id={listId}>
        {suggestions.map((alias) => (
          <option key={alias} value={alias} />
        ))}
      </datalist>
      {value && (
        <button onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-tertiary)" }}>
          <X size={12} />
        </button>
      )}
    </div>
  );
}

