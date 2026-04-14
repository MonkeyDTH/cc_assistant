import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import type { AppConfig } from "@/lib/types";

export function PreferencesPage() {
  const { appConfig, appConfigLoading, fetchAppConfig, updateAppConfig } = useAppStore();
  const [draft, setDraft] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAppConfig();
  }, [fetchAppConfig]);

  useEffect(() => {
    if (appConfig && draft === null) {
      setDraft(appConfig);
    }
  }, [appConfig, draft]);

  async function handleToggle(value: boolean) {
    if (!draft) return;
    const updated = { ...draft, minimize_to_tray: value };
    setDraft(updated);
    setSaving(true);
    try {
      await updateAppConfig(updated);
    } finally {
      setSaving(false);
    }
  }

  if (appConfigLoading || !draft) {
    return <div className="h-full px-8 py-6"><LoadingSkeleton count={2} height="h-20" /></div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 顶栏 */}
      <header
        className="px-6 py-3 border-b flex items-center gap-3 flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        <Settings2 size={15} style={{ color: "var(--accent)" }} />
        <h1 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>应用偏好</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-3">
        <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
          以下设置仅影响 CC Assistant 自身的行为，与 Claude Code 配置无关。
        </p>

        {/* 最小化到托盘 */}
        <div
          className="rounded-xl p-5"
          style={{ background: "var(--surface-card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold text-sm mb-1" style={{ color: "var(--text-primary)" }}>
                关闭时最小化到托盘
              </div>
              <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                点击窗口关闭按钮后，应用将隐藏到系统托盘而不是退出。
                可通过托盘图标重新显示或退出应用。
              </div>
            </div>
            <Toggle
              checked={draft.minimize_to_tray}
              onChange={handleToggle}
              disabled={saving}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className="flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
      style={{
        background: checked ? "var(--accent)" : "var(--surface-2)",
        border: "1px solid var(--border)",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
        style={{
          transform: checked ? "translateX(22px)" : "translateX(2px)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}
