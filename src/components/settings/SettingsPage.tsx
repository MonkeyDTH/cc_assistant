import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Eye, EyeOff, Shield, Cpu } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import type { Settings } from "@/lib/types";

const MODELS = [
  { id: "opus[1m]",   label: "Claude Opus 4.6 (1M)" },
  { id: "sonnet",     label: "Claude Sonnet 4.6" },
  { id: "haiku",      label: "Claude Haiku 4.5" },
];

export function SettingsPage() {
  const { settings, fetchSettings, updateSettings, settingsLoading } = useAppStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) setLocalSettings(settings);
  }, [settings]);

  function handleModelChange(model: string) {
    if (!localSettings) return;
    setLocalSettings({ ...localSettings, model });
  }

  async function handleSave() {
    if (localSettings) await updateSettings(localSettings);
  }

  const apiKey = (localSettings?.env as Record<string, string> | undefined)?.["ANTHROPIC_API_KEY"] ?? "";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header
        className="px-8 py-5 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>全局设置</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          管理 ~/.claude/settings.json
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {settingsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "var(--surface-2)" }} />
            ))}
          </div>
        ) : (
          <>
            {/* 模型设置 */}
            <Section icon={<Cpu size={15} />} title="默认模型">
              <div className="grid grid-cols-3 gap-3">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleModelChange(m.id)}
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

            {/* API Key */}
            <Section icon={<Shield size={15} />} title="API 密钥">
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  readOnly
                  className="w-full font-mono text-sm px-4 py-3 rounded-lg outline-none pr-10"
                  style={{
                    background: "#1a1f2e",
                    color: "#e2e8f0",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
                <button
                  onClick={() => setShowApiKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showApiKey
                    ? <EyeOff size={15} style={{ color: "var(--text-tertiary)" }} />
                    : <Eye size={15} style={{ color: "var(--text-tertiary)" }} />}
                </button>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
                在 settings.json 的 env.ANTHROPIC_API_KEY 中管理
              </p>
            </Section>

            {/* 权限预览 */}
            <Section icon={<Shield size={15} />} title="权限规则">
              <PermissionList label="允许" items={localSettings?.permissions?.allow ?? []} color="#22c55e" />
              <PermissionList label="拒绝" items={localSettings?.permissions?.deny ?? []}  color="#ef4444" />
            </Section>

            {/* 保存按钮 */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--accent)", color: "white" }}
              >
                <SettingsIcon size={14} /> 保存设置
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--surface-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
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
          <span
            key={item}
            className="font-mono text-xs px-2 py-1 rounded-md"
            style={{ background: `${color}15`, color, border: `1px solid ${color}30`, fontSize: "11px" }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
