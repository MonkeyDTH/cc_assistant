import { useEffect, useState, useCallback, useRef } from "react";
import { GitBranch, Plus, Trash2, ChevronDown, ChevronRight, Save } from "lucide-react";
import { api } from "@/lib/tauri-api";
import { SaveStatusBadge } from "@/components/ui/SaveStatusBadge";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import type { HooksConfig, HookMatcher, HookEntry } from "@/lib/types";

const HOOK_EVENTS = ["Notification", "Stop", "PreToolUse", "PostToolUse", "SubagentStop"];

interface LocalHookRule extends HookMatcher {
  _id: string;
}

type LocalHooks = Record<string, LocalHookRule[]>;

let _ruleCounter = 0;
function nextRuleId(event: string) {
  return `${event}-${++_ruleCounter}`;
}

function toLocal(config: HooksConfig): LocalHooks {
  const result: LocalHooks = {};
  for (const event of HOOK_EVENTS) {
    result[event] = (config[event] ?? []).map((rule) => ({
      ...rule,
      _id: nextRuleId(event),
    }));
  }
  return result;
}

function toConfig(local: LocalHooks): HooksConfig {
  const result: HooksConfig = {};
  for (const [event, rules] of Object.entries(local)) {
    const cleaned = rules.map(({ _id: _ignore, ...rest }) => rest);
    if (cleaned.length > 0) result[event] = cleaned;
  }
  return result;
}

export function HooksPage() {
  const [hooks, setHooks] = useState<LocalHooks>(toLocal({}));
  const [originalHooks, setOriginalHooks] = useState<LocalHooks>(toLocal({}));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // isDirty 从数据派生，无需单独维护
  const isDirty = JSON.stringify(toConfig(hooks)) !== JSON.stringify(toConfig(originalHooks));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await api.readHooks();
      const local = toLocal(config ?? {});
      setHooks(local);
      setOriginalHooks(local);
      const exp: Record<string, boolean> = {};
      for (const event of HOOK_EVENTS) {
        if ((local[event]?.length ?? 0) > 0) exp[event] = true;
      }
      setExpanded(exp);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  function toggleEvent(event: string) {
    setExpanded((prev) => ({ ...prev, [event]: !prev[event] }));
  }

  function addRule(event: string) {
    const newRule: LocalHookRule = {
      _id: nextRuleId(event),
      hooks: [{ type: "command", command: "", async: false }],
    };
    setHooks((prev) => ({ ...prev, [event]: [...(prev[event] ?? []), newRule] }));
    setExpanded((prev) => ({ ...prev, [event]: true }));
  }

  function removeRule(event: string, id: string) {
    setHooks((prev) => ({
      ...prev,
      [event]: (prev[event] ?? []).filter((r) => r._id !== id),
    }));
  }

  function updateEntry(event: string, ruleId: string, field: keyof HookEntry, value: string | boolean) {
    setHooks((prev) => ({
      ...prev,
      [event]: (prev[event] ?? []).map((r) =>
        r._id === ruleId
          ? { ...r, hooks: [{ ...r.hooks[0], [field]: value } as HookEntry] }
          : r
      ),
    }));
  }

  function updateMatcher(event: string, ruleId: string, matcher: string) {
    setHooks((prev) => ({
      ...prev,
      [event]: (prev[event] ?? []).map((r) =>
        r._id === ruleId ? { ...r, matcher: matcher || undefined } : r
      ),
    }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const config = toConfig(hooks);
      await api.writeHooks(config);
      setOriginalHooks({ ...hooks });
      setSaveStatus("saved");
      saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header
        className="px-8 py-5 border-b flex items-center gap-4 flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        <div className="flex-1">
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Hooks</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            可视化编辑 settings.json 中的 hooks 配置
          </p>
        </div>

        <SaveStatusBadge status={saveStatus} />

        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
          style={{
            background: isDirty ? "var(--accent)" : "var(--surface-2)",
            color: isDirty ? "white" : "var(--text-tertiary)",
          }}
        >
          <Save size={13} />
          {saving ? "保存中…" : "保存到 settings.json"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-3">
        {loading ? (
          <LoadingSkeleton count={3} height="h-14" />
        ) : (
          HOOK_EVENTS.map((event) => {
            const rules = hooks[event] ?? [];
            const isOpen = !!expanded[event];
            const hasRules = rules.length > 0;

            return (
              <div
                key={event}
                className="rounded-xl overflow-hidden"
                style={{
                  border: `1px solid ${hasRules ? "rgba(217,113,57,0.2)" : "var(--border)"}`,
                  background: "var(--surface-card)",
                }}
              >
                <button
                  className="w-full px-5 py-4 flex items-center gap-3 text-left"
                  onClick={() => toggleEvent(event)}
                  style={{ background: isOpen ? "rgba(217,113,57,0.03)" : "transparent" }}
                >
                  <GitBranch size={15} style={{ color: hasRules ? "var(--accent)" : "var(--text-tertiary)" }} />
                  <span className="font-mono font-medium text-sm flex-1" style={{ color: "var(--text-primary)" }}>
                    {event}
                  </span>
                  {hasRules && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-mono"
                      style={{ background: "rgba(217,113,57,0.12)", color: "var(--accent)" }}
                    >
                      {rules.length} 条规则
                    </span>
                  )}
                  {isOpen
                    ? <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} />
                    : <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />
                  }
                </button>

                {isOpen && (
                  <div className="border-t px-5 py-4 space-y-3" style={{ borderColor: "var(--border)" }}>
                    {rules.length === 0 && (
                      <p className="text-sm text-center py-3" style={{ color: "var(--text-tertiary)" }}>
                        暂无规则
                      </p>
                    )}

                    {rules.map((rule) => (
                      <div
                        key={rule._id}
                        className="rounded-lg p-4 space-y-3"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                      >
                        <div>
                          <label className="block text-xs mb-1.5" style={{ color: "var(--text-tertiary)" }}>
                            匹配规则（matcher，可选）
                          </label>
                          <input
                            type="text"
                            value={rule.matcher ?? ""}
                            onChange={(e) => updateMatcher(event, rule._id, e.target.value)}
                            placeholder="如：Bash, Read(*) 等，留空表示匹配所有"
                            className="w-full font-mono text-xs rounded-lg px-3 py-2 outline-none"
                            style={{
                              background: "var(--surface-card)",
                              color: "var(--text-primary)",
                              border: "1px solid var(--border)",
                              fontSize: "12px",
                            }}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                              执行命令
                            </label>
                            <button onClick={() => removeRule(event, rule._id)}>
                              <Trash2 size={12} style={{ color: "#ef4444" }} />
                            </button>
                          </div>
                          <textarea
                            value={rule.hooks[0]?.command ?? ""}
                            onChange={(e) => updateEntry(event, rule._id, "command", e.target.value)}
                            rows={2}
                            className="w-full font-mono text-xs rounded-lg px-3 py-2 outline-none resize-none"
                            style={{
                              background: "var(--editor-bg)",
                              color: "var(--editor-text)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              fontSize: "12px",
                              lineHeight: "1.6",
                            }}
                            placeholder='bash -c "echo hello"'
                          />
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rule.hooks[0]?.async ?? false}
                            onChange={(e) => updateEntry(event, rule._id, "async", e.target.checked)}
                            style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }}
                          />
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            异步执行（不阻塞 Claude）
                          </span>
                        </label>
                      </div>
                    ))}

                    <button
                      onClick={() => addRule(event)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        border: "1px dashed var(--border-strong)",
                        color: "var(--text-secondary)",
                        background: "transparent",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                        (e.currentTarget as HTMLElement).style.color = "var(--accent)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
                        (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                      }}
                    >
                      <Plus size={12} /> 添加规则
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
