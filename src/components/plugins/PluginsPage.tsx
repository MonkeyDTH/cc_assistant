import { useEffect, useState } from "react";
import { Puzzle, ToggleLeft, ToggleRight, ExternalLink, RefreshCw, Store, CheckCircle, Search, X } from "lucide-react";
import { api } from "@/lib/tauri-api";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import type { PluginInfo, MarketplacePlugin } from "@/lib/types";

export function PluginsPage() {

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header
        className="px-6 py-3 border-b flex items-center gap-3 flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        <h1 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>Plugins</h1>
      </header>

      <div className="flex-1 overflow-hidden">
        <InstalledPlugins />
      </div>
    </div>
  );
}

function InstalledPlugins() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setPlugins(await api.listPlugins()); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(plugin: PluginInfo) {
    setToggling(plugin.id);
    try {
      await api.setPluginEnabled(plugin.id, !plugin.enabled);
      setPlugins((prev) => prev.map((p) => p.id === plugin.id ? { ...p, enabled: !p.enabled } : p));
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-2 border-b flex-shrink-0" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {plugins.filter((p) => p.enabled).length} / {plugins.length} 已启用
        </span>
        <button onClick={load} disabled={loading} className="float-right flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <LoadingSkeleton count={3} height="h-20" />
        ) : plugins.length === 0 ? (
          <EmptyState icon={<Puzzle size={32} />} text="未找到已安装的插件" />
        ) : (
          <div className="grid gap-3">
            {plugins.map((plugin, i) => (
              <div
                key={plugin.id}
                className="rounded-xl px-5 py-4 flex items-center gap-4 animate-fade-in-up"
                style={{
                  background: "var(--surface-card)",
                  border: `1px solid ${plugin.enabled ? "rgba(217,113,57,0.2)" : "var(--border)"}`,
                  boxShadow: "var(--shadow-sm)",
                  animationDelay: `${i * 40}ms`,
                  opacity: plugin.enabled ? 1 : 0.65,
                  transition: "opacity 0.2s ease, border-color 0.2s ease",
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: plugin.enabled ? "rgba(217,113,57,0.1)" : "var(--surface-2)",
                    border: `1px solid ${plugin.enabled ? "rgba(217,113,57,0.2)" : "var(--border)"}`,
                  }}
                >
                  <Puzzle size={16} style={{ color: plugin.enabled ? "var(--accent)" : "var(--text-tertiary)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{plugin.name}</span>
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--surface-2)", color: "var(--text-tertiary)", fontSize: "10px" }}>v{plugin.version}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--surface-2)", color: "var(--text-tertiary)", fontSize: "10px" }}>{plugin.scope}</span>
                  </div>
                  {plugin.description && (
                    <p className="text-sm mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>{plugin.description}</p>
                  )}
                  <p className="font-mono text-xs mt-0.5" style={{ color: "var(--text-tertiary)", fontSize: "10px" }}>{plugin.id}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {plugin.homepage && (
                    <a href={plugin.homepage} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} style={{ color: "var(--text-tertiary)" }} />
                    </a>
                  )}
                  <button onClick={() => handleToggle(plugin)} disabled={toggling === plugin.id} className="disabled:opacity-50">
                    {plugin.enabled
                      ? <ToggleRight size={26} style={{ color: "var(--accent)" }} />
                      : <ToggleLeft size={26} style={{ color: "var(--text-tertiary)" }} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function _MarketplaceBrowser() {
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterInstalled, setFilterInstalled] = useState<"all" | "installed" | "available">("all");

  useEffect(() => {
    setLoading(true);
    api.listMarketplacePlugins()
      .then(setPlugins)
      .finally(() => setLoading(false));
  }, []);

  const filtered = plugins.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q)
      || (p.description ?? "").toLowerCase().includes(q)
      || p.keywords.some((k) => k.toLowerCase().includes(q));
    const matchFilter =
      filterInstalled === "all" ? true :
      filterInstalled === "installed" ? p.installed :
      !p.installed;
    return matchSearch && matchFilter;
  });

  const installedCount = plugins.filter((p) => p.installed).length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 搜索和过滤栏 */}
      <div
        className="px-6 py-3 border-b flex items-center gap-3 flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索插件名称、描述、标签…"
            className="w-full pl-8 pr-8 py-1.5 rounded-lg text-sm outline-none"
            style={{ background: "var(--surface-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
          {search && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
              <X size={12} style={{ color: "var(--text-tertiary)" }} />
            </button>
          )}
        </div>

        {(["all", "installed", "available"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterInstalled(f)}
            className="text-xs px-2.5 py-1 rounded-lg transition-colors"
            style={{
              background: filterInstalled === f ? "var(--accent)" : "var(--surface-card)",
              color: filterInstalled === f ? "white" : "var(--text-secondary)",
              border: `1px solid ${filterInstalled === f ? "transparent" : "var(--border)"}`,
            }}
          >
            {f === "all" ? `全部 (${plugins.length})` : f === "installed" ? `已安装 (${installedCount})` : `可安装 (${plugins.length - installedCount})`}
          </button>
        ))}
      </div>

      {/* 插件列表 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <LoadingSkeleton count={4} height="h-20" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Store size={32} />} text={search ? "无匹配插件" : "市场暂无插件"} />
        ) : (
          <div className="grid gap-3">
            {filtered.map((plugin, i) => (
              <_MarketplacePluginCard key={plugin.id} plugin={plugin} animDelay={i * 30} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function _MarketplacePluginCard({ plugin, animDelay }: { plugin: MarketplacePlugin; animDelay: number }) {
  return (
    <div
      className="rounded-xl px-5 py-4 flex items-center gap-4 animate-fade-in-up"
      style={{
        background: "var(--surface-card)",
        border: `1px solid ${plugin.installed ? "rgba(34,197,94,0.2)" : "var(--border)"}`,
        boxShadow: "var(--shadow-sm)",
        animationDelay: `${animDelay}ms`,
      }}
    >
      {/* 图标 */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: plugin.installed ? "rgba(34,197,94,0.1)" : "var(--surface-2)",
          border: `1px solid ${plugin.installed ? "rgba(34,197,94,0.2)" : "var(--border)"}`,
        }}
      >
        <Puzzle size={16} style={{ color: plugin.installed ? "#22c55e" : "var(--text-tertiary)" }} />
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{plugin.name}</span>
          {plugin.version && (
            <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--surface-2)", color: "var(--text-tertiary)", fontSize: "10px" }}>v{plugin.version}</span>
          )}
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--surface-2)", color: "var(--text-tertiary)", fontSize: "10px" }}>{plugin.marketplace_id}</span>
          {plugin.keywords.slice(0, 3).map((k) => (
            <span key={k} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(217,113,57,0.08)", color: "var(--accent)", fontSize: "10px" }}>{k}</span>
          ))}
        </div>
        {plugin.description && (
          <p className="text-sm mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>{plugin.description}</p>
        )}
      </div>

      {/* 状态 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {plugin.homepage && (
          <a href={plugin.homepage} target="_blank" rel="noreferrer">
            <ExternalLink size={13} style={{ color: "var(--text-tertiary)" }} />
          </a>
        )}
        {plugin.installed ? (
          <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
            style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
            <CheckCircle size={11} />
            {plugin.installed_version ? `v${plugin.installed_version}` : "已安装"}
          </div>
        ) : (
          <div className="text-xs px-3 py-1 rounded-lg"
            style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            通过 Claude Code 安装
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2">
      <span style={{ color: "var(--text-tertiary)" }}>{icon}</span>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{text}</p>
    </div>
  );
}
