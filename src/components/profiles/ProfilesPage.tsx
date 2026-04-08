import { useEffect, useState } from "react";
import {
  KeyRound,
  Link,
  Cpu,
  Plus,
  Check,
  Trash2,
  Pencil,
  X,
  Save,
  Eye,
  EyeOff,
  Zap,
  Hash,
} from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import type { ApiProfile, ProfilesConfig } from "@/lib/types";

// 生成唯一 ID
function genId(): string {
  return crypto.randomUUID();
}

function emptyProfile(): ApiProfile {
  return {
    id: genId(),
    name: "",
    apiKey: "",
    baseUrl: "",
    models: { opus: "", sonnet: "", haiku: "" },
  };
}

export function ProfilesPage() {
  const { profilesConfig, profilesLoading, fetchProfiles, saveProfiles, switchProfile } =
    useAppStore();

  // 正在编辑的 profile（null = 未编辑，"new" = 新建）
  const [editingId, setEditingId] = useState<string | null>(null);
  // 编辑表单草稿
  const [draft, setDraft] = useState<ApiProfile>(emptyProfile());
  // 各字段的 API Key 是否可见
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  // 激活中状态
  const [activatingId, setActivatingId] = useState<string | null>(null);
  // 保存中状态
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  if (profilesLoading) {
    return (
      <div className="h-full px-8 py-6">
        <LoadingSkeleton count={3} height="h-24" />
      </div>
    );
  }

  const config: ProfilesConfig = profilesConfig ?? { activeProfileId: null, profiles: [] };
  const activeId = config.activeProfileId;

  // 开始编辑某个 profile
  function startEdit(profile: ApiProfile) {
    setDraft({ ...profile, models: { ...profile.models } });
    setEditingId(profile.id);
    setApiKeyVisible(false);
  }

  // 开始新建
  function startNew() {
    setDraft(emptyProfile());
    setEditingId("new");
    setApiKeyVisible(false);
  }

  // 取消编辑
  function cancelEdit() {
    setEditingId(null);
  }

  // 保存编辑/新建
  async function saveEdit() {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      let updated: ApiProfile[];
      if (editingId === "new") {
        updated = [...config.profiles, { ...draft, id: genId() }];
      } else {
        updated = config.profiles.map((p) => (p.id === editingId ? draft : p));
      }
      await saveProfiles({ ...config, profiles: updated });
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  // 删除 profile
  async function deleteProfile(id: string) {
    const updated = config.profiles.filter((p) => p.id !== id);
    const newActive = activeId === id ? null : activeId;
    await saveProfiles({ ...config, profiles: updated, activeProfileId: newActive });
  }

  // 激活 profile
  async function activate(id: string) {
    setActivatingId(id);
    try {
      await switchProfile(id);
    } finally {
      setActivatingId(null);
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 顶栏 */}
      <header
        className="px-6 py-3 border-b flex items-center gap-3 flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        <KeyRound size={15} style={{ color: "var(--accent)" }} />
        <h1 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
          API Profiles
        </h1>
        <div style={{ width: "1px", height: "18px", background: "var(--border)" }} />
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          管理多套 API Key / 端点，一键切换
        </span>
        <button
          onClick={startNew}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: "var(--accent)", color: "white" }}
        >
          <Plus size={13} /> 新建 Profile
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-3">
        {config.profiles.length === 0 && editingId !== "new" && (
          <div
            className="rounded-xl p-8 flex flex-col items-center gap-3"
            style={{ border: "1px dashed var(--border)", color: "var(--text-tertiary)" }}
          >
            <KeyRound size={28} style={{ opacity: 0.4 }} />
            <p className="text-sm">还没有任何 Profile，点击右上角新建</p>
          </div>
        )}

        {/* 新建表单（列表顶部）*/}
        {editingId === "new" && (
          <ProfileForm
            draft={draft}
            onChange={setDraft}
            onSave={saveEdit}
            onCancel={cancelEdit}
            saving={saving}
            apiKeyVisible={apiKeyVisible}
            onToggleApiKey={() => setApiKeyVisible((v) => !v)}
            isNew
          />
        )}

        {/* 已有 profiles */}
        {config.profiles.map((profile) =>
          editingId === profile.id ? (
            <ProfileForm
              key={profile.id}
              draft={draft}
              onChange={setDraft}
              onSave={saveEdit}
              onCancel={cancelEdit}
              saving={saving}
              apiKeyVisible={apiKeyVisible}
              onToggleApiKey={() => setApiKeyVisible((v) => !v)}
            />
          ) : (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isActive={profile.id === activeId}
              activating={activatingId === profile.id}
              onActivate={() => activate(profile.id)}
              onEdit={() => startEdit(profile)}
              onDelete={() => deleteProfile(profile.id)}
            />
          )
        )}
      </div>
    </div>
  );
}

// ── Profile 卡片（只读展示）──
function ProfileCard({
  profile,
  isActive,
  activating,
  onActivate,
  onEdit,
  onDelete,
}: {
  profile: ApiProfile;
  isActive: boolean;
  activating: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const maskedKey = profile.apiKey
    ? `${profile.apiKey.slice(0, 8)}${"•".repeat(Math.max(0, profile.apiKey.length - 12))}${profile.apiKey.slice(-4)}`
    : "未设置";

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "var(--surface-card)",
        border: `1px solid ${isActive ? "rgba(217,113,57,0.4)" : "var(--border)"}`,
        boxShadow: isActive ? "0 0 0 1px rgba(217,113,57,0.15)" : "var(--shadow-sm)",
      }}
    >
      {/* 标题行 */}
      <div className="flex items-center gap-2 mb-4">
        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          {profile.name || "未命名"}
        </span>
        {isActive && (
          <span
            className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: "rgba(217,113,57,0.12)", color: "var(--accent)" }}
          >
            <Check size={10} /> 当前激活
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {!isActive && (
            <button
              onClick={onActivate}
              disabled={activating}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{
                background: "rgba(217,113,57,0.1)",
                color: "var(--accent)",
                border: "1px solid rgba(217,113,57,0.2)",
                opacity: activating ? 0.6 : 1,
              }}
            >
              <Zap size={11} />
              {activating ? "切换中…" : "激活"}
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg"
            style={{ color: "var(--text-tertiary)", background: "var(--surface-2)" }}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg"
            style={{ color: "var(--text-tertiary)", background: "var(--surface-2)" }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* 详情 */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <InfoRow icon={<KeyRound size={11} />} label="API Key" value={maskedKey} mono />
        <InfoRow
          icon={<Link size={11} />}
          label="端点"
          value={profile.baseUrl || "https://api.anthropic.com（默认）"}
          mono
        />
        <InfoRow icon={<Cpu size={11} />} label="Opus" value={profile.models.opus || "—"} mono />
        <InfoRow
          icon={<Cpu size={11} />}
          label="Sonnet"
          value={profile.models.sonnet || "—"}
          mono
        />
        <InfoRow icon={<Cpu size={11} />} label="Haiku" value={profile.models.haiku || "—"} mono />
      </div>
      {/* 额外环境变量 */}
      {Object.keys(profile.extraEnvVars ?? {}).length > 0 && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-1 text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>
            <Hash size={11} />
            <span>额外环境变量（{Object.keys(profile.extraEnvVars!).length} 项）</span>
          </div>
          <div className="space-y-1">
            {Object.entries(profile.extraEnvVars ?? {}).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 font-mono text-xs">
                <span className="px-2 py-0.5 rounded" style={{ background: "var(--surface-2)", color: "var(--accent)" }}>{k}</span>
                <span style={{ color: "var(--text-tertiary)" }}>=</span>
                <span className="truncate" style={{ color: v ? "var(--text-secondary)" : "var(--text-tertiary)" }}>
                  {v || "（空，激活时删除）"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-1 mb-1"
        style={{ color: "var(--text-tertiary)" }}
      >
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={`px-2 py-1 rounded-lg truncate ${mono ? "font-mono" : ""}`}
        style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Profile 编辑表单 ──
function ProfileForm({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  apiKeyVisible,
  onToggleApiKey,
  isNew,
}: {
  draft: ApiProfile;
  onChange: (p: ApiProfile) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  apiKeyVisible: boolean;
  onToggleApiKey: () => void;
  isNew?: boolean;
}) {
  function field(key: keyof Omit<ApiProfile, "models" | "id">) {
    return (value: string) => onChange({ ...draft, [key]: value });
  }
  function modelField(key: keyof ApiProfile["models"]) {
    return (value: string) =>
      onChange({ ...draft, models: { ...draft.models, [key]: value } });
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "var(--surface-card)",
        border: "1px solid rgba(217,113,57,0.4)",
        boxShadow: "0 0 0 1px rgba(217,113,57,0.15)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          {isNew ? "新建 Profile" : "编辑 Profile"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs"
            style={{ color: "var(--text-secondary)", background: "var(--surface-2)" }}
          >
            <X size={12} /> 取消
          </button>
          <button
            onClick={onSave}
            disabled={saving || !draft.name.trim()}
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium"
            style={{
              background: "var(--accent)",
              color: "white",
              opacity: saving || !draft.name.trim() ? 0.6 : 1,
            }}
          >
            <Save size={12} /> {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* 名称 */}
        <FormField label="名称 *">
          <input
            value={draft.name}
            onChange={(e) => field("name")(e.target.value)}
            placeholder="例如：官方 Anthropic"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </FormField>

        {/* API Key */}
        <FormField label="API Key" icon={<KeyRound size={12} />}>
          <div className="relative">
            <input
              type={apiKeyVisible ? "text" : "password"}
              value={draft.apiKey}
              onChange={(e) => field("apiKey")(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none pr-9"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <button
              type="button"
              onClick={onToggleApiKey}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-tertiary)" }}
            >
              {apiKeyVisible ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </FormField>

        {/* 端点 URL */}
        <FormField label="端点 URL" icon={<Link size={12} />}>
          <input
            value={draft.baseUrl}
            onChange={(e) => field("baseUrl")(e.target.value)}
            placeholder="https://api.anthropic.com（留空使用默认）"
            className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </FormField>

        {/* 模型 IDs */}
        <div className="grid grid-cols-3 gap-2">
          <FormField label="Opus 模型 ID" icon={<Cpu size={12} />}>
            <input
              value={draft.models.opus}
              onChange={(e) => modelField("opus")(e.target.value)}
              placeholder="claude-opus-4-6"
              className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </FormField>
          <FormField label="Sonnet 模型 ID" icon={<Cpu size={12} />}>
            <input
              value={draft.models.sonnet}
              onChange={(e) => modelField("sonnet")(e.target.value)}
              placeholder="claude-sonnet-4-6"
              className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </FormField>
          <FormField label="Haiku 模型 ID" icon={<Cpu size={12} />}>
            <input
              value={draft.models.haiku}
              onChange={(e) => modelField("haiku")(e.target.value)}
              placeholder="claude-haiku-4-5-20251001"
              className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </FormField>
        </div>

        {/* 额外环境变量（如 OPENROUTER_API_KEY、ANTHROPIC_AUTH_TOKEN 等） */}
        <ExtraEnvVarsEditor
          key={`env-${draft.id}`}
          value={draft.extraEnvVars ?? {}}
          onChange={(vars) => onChange({ ...draft, extraEnvVars: vars })}
        />
      </div>
    </div>
  );
}

// ── 额外环境变量键值对编辑器 ──
function ExtraEnvVarsEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const [rows, setRows] = useState<{ key: string; val: string }[]>(() =>
    Object.entries(value).map(([key, val]) => ({ key, val }))
  );

  function sync(next: { key: string; val: string }[]) {
    setRows(next);
    const result: Record<string, string> = {};
    for (const { key, val } of next) {
      if (key.trim()) result[key.trim()] = val;
    }
    onChange(result);
  }

  function addRow() { sync([...rows, { key: "", val: "" }]); }
  function removeRow(i: number) { sync(rows.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, field: "key" | "val", v: string) {
    sync(rows.map((r, idx) => idx === i ? { ...r, [field]: v } : r));
  }

  return (
    <div>
      <div className="flex items-center gap-1 text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>
        <div style={{ width: 12 }} />
        <span>额外环境变量（激活时写入 settings.json env；值留空 = 删除该变量）</span>
        <button
          type="button"
          onClick={addRow}
          className="ml-auto flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
        >
          <Plus size={10} /> 添加
        </button>
      </div>
      {rows.length === 0 && (
        <div className="text-xs px-2 py-1.5 rounded-lg" style={{ color: "var(--text-tertiary)", background: "var(--surface-2)" }}>
          无额外环境变量（例：OPENROUTER_API_KEY、ANTHROPIC_AUTH_TOKEN）
        </div>
      )}
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              value={row.key}
              onChange={(e) => updateRow(i, "key", e.target.value)}
              placeholder="ENV_VAR_NAME"
              className="w-2/5 px-2 py-1.5 rounded-lg text-xs font-mono outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <span style={{ color: "var(--text-tertiary)", fontSize: "10px" }}>=</span>
            <input
              value={row.val}
              onChange={(e) => updateRow(i, "val", e.target.value)}
              placeholder="value（留空=激活时删除该变量）"
              className="flex-1 px-2 py-1.5 rounded-lg text-xs font-mono outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="p-1 rounded"
              style={{ color: "var(--text-tertiary)" }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormField({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-1 text-xs mb-1"
        style={{ color: "var(--text-tertiary)" }}
      >
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}
