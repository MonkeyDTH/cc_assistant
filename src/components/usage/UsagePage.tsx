import { useEffect, useRef, useState } from "react";
import { RefreshCw, TrendingUp, Zap, FolderOpen, AlertCircle } from "lucide-react";
import { api } from "@/lib/tauri-api";
import type { CodburnData, CodburnSummary, CodburnPeriod, CodburnProject, CodburnSession } from "@/lib/types";

// ——— 工具函数 ———

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function shortProject(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).slice(-2).join("/");
}

// 从 sessions 按时间段聚合项目消耗
function projectsForPeriod(sessions: CodburnSession[], period: CodburnPeriod): CodburnProject[] {
  const dates = new Set(period.daily.map((d) => d.Date));
  const map = new Map<string, { cost: number; calls: number; sessions: number }>();
  for (const s of sessions) {
    const date = s["Started At"].slice(0, 10);
    if (!dates.has(date)) continue;
    const key = s.Project;
    const cur = map.get(key) ?? { cost: 0, calls: 0, sessions: 0 };
    cur.cost += s["Cost (USD)"];
    cur.calls += s["API Calls"];
    cur.sessions += 1;
    map.set(key, cur);
  }
  const total = Array.from(map.values()).reduce((s, v) => s + v.cost, 0);
  return Array.from(map.entries())
    .map(([project, v]) => ({
      Project: project,
      "Cost (USD)": v.cost,
      "Avg/Session (USD)": v.sessions > 0 ? v.cost / v.sessions : 0,
      "Share (%)": total > 0 ? (v.cost / total) * 100 : 0,
      "API Calls": v.calls,
      Sessions: v.sessions,
    }))
    .sort((a, b) => b["Cost (USD)"] - a["Cost (USD)"]);
}

// ——— 子组件 ———

function SummaryCard({ item }: { item: CodburnSummary }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: "var(--surface-card)", border: "1px solid var(--border)" }}
    >
      <div className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
        {item.Period}
      </div>
      <div className="text-3xl font-bold" style={{ color: "var(--accent)" }}>
        {fmtCost(item["Cost (USD)"])}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="API 调用" value={fmt(item["API Calls"])} />
        <Stat label="会话数" value={String(item.Sessions)} />
        <Stat label="项目数" value={String(item.Projects)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{value}</div>
      <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{label}</div>
    </div>
  );
}

function DailyChart({ period }: { period: CodburnPeriod }) {
  const daily = period.daily;
  const barAreaRef = useRef<HTMLDivElement>(null);
  const [barAreaH, setBarAreaH] = useState(96);

  useEffect(() => {
    const el = barAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBarAreaH(el.clientHeight));
    ro.observe(el);
    setBarAreaH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  if (!daily.length) return null;
  const max = Math.max(...daily.map((d) => d["Cost (USD)"]));

  return (
    <div
      className="rounded-xl p-5 flex flex-col"
      style={{ background: "var(--surface-card)", border: "1px solid var(--border)" }}
    >
      <div className="text-sm font-semibold mb-4 flex-shrink-0" style={{ color: "var(--text-primary)" }}>
        每日费用 · {period.label}
      </div>
      {/* 弹性区域：柱子 */}
      <div ref={barAreaRef} style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 4, minHeight: 60 }}>
        {daily.map((d) => {
          const ratio = max > 0 ? d["Cost (USD)"] / max : 0;
          const barH = Math.max(ratio * barAreaH, 2);
          return (
            <div
              key={d.Date}
              className="group"
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}
            >
              <div
                className="absolute opacity-0 group-hover:opacity-100 pointer-events-none z-10"
                style={{
                  bottom: "100%", marginBottom: 4,
                  padding: "2px 6px", borderRadius: 4,
                  background: "var(--surface-card)", border: "1px solid var(--border)",
                  color: "var(--text-primary)", fontSize: 11, whiteSpace: "nowrap",
                }}
              >
                {d.Date}: {fmtCost(d["Cost (USD)"])}
              </div>
              <div
                style={{
                  width: "100%", height: barH,
                  background: ratio > 0.7 ? "var(--accent)" : "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "3px 3px 0 0",
                }}
              />
            </div>
          );
        })}
      </div>
      {/* 日期标签行 */}
      <div className="flex-shrink-0" style={{ display: "flex", gap: 4, marginTop: 4 }}>
        {daily.map((d) => (
          <div key={d.Date} style={{ flex: 1, textAlign: "center", fontSize: 9, fontFamily: "monospace", color: "var(--text-tertiary)" }}>
            {d.Date.slice(5)}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityBreakdown({ period }: { period: CodburnPeriod }) {
  const items = period.activity.filter((a) => a["Cost (USD)"] > 0);
  if (!items.length) return null;
  const max = Math.max(...items.map((a) => a["Share (%)"]));
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--surface-card)", border: "1px solid var(--border)" }}
    >
      <div className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        活动类型 · {period.label}
      </div>
      <div className="flex flex-col gap-2">
        {items.map((a) => (
          <div key={a.Activity} className="flex items-center gap-3">
            <div className="w-24 text-xs truncate" style={{ color: "var(--text-secondary)" }}>{a.Activity}</div>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${(a["Share (%)"] / max) * 100}%`, background: "var(--accent)" }}
              />
            </div>
            <div className="text-xs font-mono w-16 text-right" style={{ color: "var(--text-primary)" }}>
              {fmtCost(a["Cost (USD)"])}
            </div>
            <div className="text-xs w-12 text-right" style={{ color: "var(--text-tertiary)" }}>
              {a.Turns}次
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelBreakdown({ period }: { period: CodburnPeriod }) {
  const items = period.models;
  if (!items.length) return null;
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--surface-card)", border: "1px solid var(--border)" }}
    >
      <div className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        模型分布 · {period.label}
      </div>
      <div className="flex flex-col gap-3">
        {items.map((m) => (
          <div key={m.Model} className="flex items-center gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{m.Model}</span>
                <span className="text-xs font-mono" style={{ color: "var(--accent)" }}>{fmtCost(m["Cost (USD)"])}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${m["Share (%)"]}%`, background: "var(--accent)" }}
                />
              </div>
              <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {m["Share (%)"].toFixed(1)}% · {fmt(m["API Calls"])} 次调用
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectsTable({ projects, label }: { projects: CodburnProject[]; label: string }) {
  const top = projects.slice(0, 10);
  const max = top[0]?.["Cost (USD)"] ?? 1;
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--surface-card)", border: "1px solid var(--border)" }}
    >
      <div className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        项目消耗 · {label}
      </div>
      <div className="flex flex-col gap-2">
        {top.map((p) => (
          <div key={p.Project} className="flex items-center gap-3 group">
            <div
              className="w-36 text-xs truncate font-mono"
              style={{ color: "var(--text-secondary)" }}
              title={p.Project}
            >
              {shortProject(p.Project)}
            </div>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(p["Cost (USD)"] / max) * 100}%`, background: "var(--accent)" }}
              />
            </div>
            <div className="text-xs font-mono w-16 text-right" style={{ color: "var(--text-primary)" }}>
              {fmtCost(p["Cost (USD)"])}
            </div>
            <div className="text-xs w-20 text-right" style={{ color: "var(--text-tertiary)" }}>
              {p.Sessions} 会话
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ——— 模块级缓存，页面卸载后仍保留 ———
let cachedData: CodburnData | null = null;

// ——— 主页面 ———

export function UsagePage() {
  const [data, setData] = useState<CodburnData | null>(cachedData);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 默认展示 7 天维度
  const [periodIdx, setPeriodIdx] = useState(1);

  async function load(silent = false) {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const result = await api.getCodburnData();
      cachedData = result;
      setData(result);
      setError(null);
    } catch (e) {
      if (!silent) setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    // 有缓存时静默刷新，无缓存时全量加载
    load(cachedData !== null);
  }, []);

  const period = data?.periods[periodIdx] ?? null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 页头 */}
      <header
        className="px-8 py-5 flex items-center justify-between border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            用量统计
          </h1>
          <p className="text-sm mt-0.5 flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            {data ? `数据生成于 ${new Date(data.generated).toLocaleString()}` : "由 codeburn 提供数据"}
            {refreshing && (
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                <RefreshCw size={11} className="animate-spin" />
                刷新中…
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => load(false)}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          刷新
        </button>
      </header>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* 未安装 codeburn */}
        {error && error.includes("启动 codeburn 失败") && !data && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <AlertCircle size={24} style={{ color: "var(--text-tertiary)" }} />
            </div>
            <div>
              <div className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                未检测到 codeburn
              </div>
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                此页面需要安装 codeburn 来获取用量数据
              </div>
            </div>
            <div
              className="px-4 py-3 rounded-xl text-left"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <div className="text-xs mb-1.5 font-medium" style={{ color: "var(--text-tertiary)" }}>安装命令</div>
              <code className="text-sm font-mono" style={{ color: "var(--accent)" }}>
                npm install -g @agentseal/codeburn
              </code>
            </div>
            <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              安装后重新打开此页面即可
            </div>
          </div>
        )}

        {/* 其他错误 */}
        {error && !error.includes("启动 codeburn 失败") && (
          <div
            className="mb-6 flex items-start gap-3 p-4 rounded-xl"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#ef4444" }} />
            <div>
              <div className="text-sm font-medium" style={{ color: "#ef4444" }}>codeburn 执行失败</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{error}</div>
            </div>
          </div>
        )}

        {/* 加载中占位 */}
        {loading && !data && (
          <div className="flex items-center justify-center h-48 gap-2" style={{ color: "var(--text-tertiary)" }}>
            <div className="w-4 h-4 border-2 rounded-full animate-spin"
              style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
            <span className="text-sm">正在获取用量数据…</span>
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-6">
            {/* 摘要卡片 */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} style={{ color: "var(--accent)" }} />
                <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                  费用摘要
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {data.summary.map((s) => <SummaryCard key={s.Period} item={s} />)}
              </div>
            </section>

            {/* 时间段切换 */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} style={{ color: "var(--accent)" }} />
                <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                  详细分析
                </span>
                <div className="ml-auto flex gap-1">
                  {data.periods.map((p, i) => (
                    <button
                      key={p.label}
                      onClick={() => setPeriodIdx(i)}
                      className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: periodIdx === i ? "var(--accent)" : "var(--surface-2)",
                        color: periodIdx === i ? "white" : "var(--text-secondary)",
                        border: `1px solid ${periodIdx === i ? "var(--accent)" : "var(--border)"}`,
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {period && (
                <div className="grid grid-cols-2 gap-4">
                  <DailyChart period={period} />
                  <ModelBreakdown period={period} />
                </div>
              )}
            </section>

            {/* 项目排行 + 活动类型 并排 */}
            {(data.projects.length > 0 || period) && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen size={14} style={{ color: "var(--accent)" }} />
                  <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                    项目排行 &amp; 活动类型
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {period && (
                    <ProjectsTable
                      projects={projectsForPeriod(data.sessions, period)}
                      label={period.label}
                    />
                  )}
                  {period && <ActivityBreakdown period={period} />}
                </div>
              </section>
            )}

            {/* 底部来源说明 */}
            <div className="text-center text-xs pb-2" style={{ color: "var(--text-tertiary)" }}>
              数据来源: codeburn · {data.currency.code} 计价
              <span className="ml-2 opacity-60">· 本地读取，不上传任何数据</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
