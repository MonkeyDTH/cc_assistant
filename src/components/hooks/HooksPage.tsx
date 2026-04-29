import { useEffect, useState, useCallback, useRef } from "react";
import { GitBranch, Plus, Trash2, ChevronDown, ChevronRight, Save } from "lucide-react";
import { api } from "@/lib/tauri-api";
import { SaveStatusBadge } from "@/components/ui/SaveStatusBadge";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { useAppStore } from "@/stores/app-store";
import type { HooksConfig, HookMatcher, HookEntry } from "@/lib/types";

interface HookGroup {
  label: string;
  events: string[];
}

const HOOK_GROUPS: HookGroup[] = [
  { label: "会话生命周期", events: ["SessionStart", "SessionEnd", "InstructionsLoaded"] },
  { label: "用户交互", events: ["UserPromptSubmit"] },
  { label: "工具调用", events: ["PreToolUse", "PostToolUse", "PostToolUseFailure", "PermissionRequest", "PermissionDenied"] },
  { label: "代理与任务", events: ["SubagentStart", "SubagentStop", "TaskCreated", "TaskCompleted", "TeammateIdle"] },
  { label: "响应结束", events: ["Stop", "StopFailure"] },
  { label: "系统事件", events: ["Notification", "ConfigChange", "CwdChanged", "FileChanged", "PreCompact", "PostCompact"] },
  { label: "MCP 工具", events: ["Elicitation", "ElicitationResult"] },
  { label: "Worktree", events: ["WorktreeCreate", "WorktreeRemove"] },
];

const HOOK_EVENTS = HOOK_GROUPS.flatMap((g) => g.events);

const HOOK_EVENT_DESCRIPTIONS: Record<string, string> = {
  SessionStart: "会话开始或恢复时触发",
  SessionEnd: "会话结束时触发",
  InstructionsLoaded: "CLAUDE.md / rules 文件加载到上下文时触发",
  UserPromptSubmit: "用户提交 prompt、Claude 处理前触发",
  PreToolUse: "每次工具调用前触发，可阻断执行",
  PostToolUse: "工具调用成功后触发",
  PostToolUseFailure: "工具调用失败后触发",
  PermissionRequest: "权限确认弹窗出现时触发",
  PermissionDenied: "工具被自动拒绝时触发",
  SubagentStart: "子代理启动时触发",
  SubagentStop: "子代理完成任务时触发",
  TaskCreated: "TaskCreate 创建任务时触发",
  TaskCompleted: "任务标记完成时触发",
  TeammateIdle: "团队代理即将闲置时触发",
  Stop: "Claude 完成响应、停止时触发",
  StopFailure: "因 API 错误导致轮次结束时触发",
  Notification: "Claude 需要提醒用户时触发",
  ConfigChange: "会话中配置文件变更时触发",
  CwdChanged: "工作目录切换时触发",
  FileChanged: "被监视的文件在磁盘发生变化时触发",
  PreCompact: "上下文压缩前触发",
  PostCompact: "上下文压缩完成后触发",
  Elicitation: "MCP 服务器在工具调用中请求用户输入时触发",
  ElicitationResult: "用户响应 MCP elicitation 后触发",
  WorktreeCreate: "创建 worktree 时触发",
  WorktreeRemove: "移除 worktree 时触发",
};

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
  // 分组折叠状态，key 为 group label，默认全部展开
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>(
    () => Object.fromEntries(HOOK_GROUPS.map((g) => [g.label, true]))
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // 仅显示已配置的 hook 事件——持久化在 AppConfig 中
  const appConfig = useAppStore((s) => s.appConfig);
  const updateAppConfig = useAppStore((s) => s.updateAppConfig);
  const fetchAppConfig = useAppStore((s) => s.fetchAppConfig);
  const onlyConfigured = appConfig?.hooks_only_configured ?? false;
  const setOnlyConfigured = (v: boolean) => {
    if (!appConfig) return;
    updateAppConfig({ ...appConfig, hooks_only_configured: v });
  };

  useEffect(() => {
    if (!appConfig) fetchAppConfig();
  }, [appConfig, fetchAppConfig]);
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

  function toggleGroup(label: string) {
    setGroupExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
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

        {/* 仅显示已配置开关 */}
        <label className="flex items-center gap-2 cursor-pointer select-none mr-2">
          <input
            type="checkbox"
            checked={onlyConfigured}
            onChange={(e) => setOnlyConfigured(e.target.checked)}
            style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }}
          />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            仅显示已配置
          </span>
        </label>

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

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {loading ? (
          <LoadingSkeleton count={3} height="h-14" />
        ) : (
          HOOK_GROUPS.map((group) => {
            const isGroupOpen = !!groupExpanded[group.label];
            const totalRules = group.events.reduce((sum, e) => sum + (hooks[e]?.length ?? 0), 0);
            // 仅显示已配置时，过滤掉无规则的事件；整组都为空则不渲染
            const visibleEvents = onlyConfigured
              ? group.events.filter((e) => (hooks[e]?.length ?? 0) > 0)
              : group.events;
            if (onlyConfigured && visibleEvents.length === 0) return null;

            return (
              <div key={group.label}>
                {/* 分组标题行 */}
                <button
                  className="w-full flex items-center gap-2 mb-2 px-1 py-1 rounded-lg transition-all text-left"
                  onClick={() => toggleGroup(group.label)}
                  style={{ background: "transparent" }}
                >
                  {isGroupOpen
                    ? <ChevronDown size={13} style={{ color: "var(--text-tertiary)" }} />
                    : <ChevronRight size={13} style={{ color: "var(--text-tertiary)" }} />
                  }
                  <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--text-tertiary)" }}>
                    {group.label}
                  </span>
                  {totalRules > 0 && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full font-mono"
                      style={{ background: "rgba(217,113,57,0.12)", color: "var(--accent)" }}
                    >
                      {totalRules}
                    </span>
                  )}
                  <div className="flex-1 h-px ml-1" style={{ background: "var(--border)" }} />
                </button>

                {/* 分组内的事件列表 */}
                {isGroupOpen && (
                  <div className="space-y-2 pl-2">
                    {visibleEvents.map((event) => {
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
                            className="w-full px-5 py-3 flex items-center gap-3 text-left"
                            onClick={() => toggleEvent(event)}
                            style={{ background: isOpen ? "rgba(217,113,57,0.03)" : "transparent" }}
                          >
                            <GitBranch size={14} style={{ color: hasRules ? "var(--accent)" : "var(--text-tertiary)" }} />
                            <span className="font-mono font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                              {event}
                            </span>
                            <span className="text-xs flex-1" style={{ color: "var(--text-tertiary)" }}>
                              {HOOK_EVENT_DESCRIPTIONS[event]}
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
                    })}
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
