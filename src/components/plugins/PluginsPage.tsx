import { useEffect, useState } from "react";
import { Puzzle, ToggleLeft, ToggleRight, ExternalLink, RefreshCw } from "lucide-react";
import { api } from "@/lib/tauri-api";
import type { PluginInfo } from "@/lib/types";

export function PluginsPage() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listPlugins();
      setPlugins(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(plugin: PluginInfo) {
    setToggling(plugin.id);
    try {
      await api.setPluginEnabled(plugin.id, !plugin.enabled);
      setPlugins((prev) =>
        prev.map((p) => (p.id === plugin.id ? { ...p, enabled: !p.enabled } : p))
      );
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header
        className="px-8 py-5 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Plugins</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {plugins.filter((p) => p.enabled).length} / {plugins.length} 已启用
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          刷新
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--surface-2)" }} />
            ))}
          </div>
        ) : plugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Puzzle size={32} style={{ color: "var(--text-tertiary)" }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>未找到已安装的插件</p>
          </div>
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
                {/* 图标 */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: plugin.enabled ? "rgba(217,113,57,0.1)" : "var(--surface-2)",
                    border: `1px solid ${plugin.enabled ? "rgba(217,113,57,0.2)" : "var(--border)"}`,
                  }}
                >
                  <Puzzle size={16} style={{ color: plugin.enabled ? "var(--accent)" : "var(--text-tertiary)" }} />
                </div>

                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                      {plugin.name}
                    </span>
                    <span
                      className="font-mono text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "var(--surface-2)", color: "var(--text-tertiary)", fontSize: "10px" }}
                    >
                      v{plugin.version}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "var(--surface-2)", color: "var(--text-tertiary)", fontSize: "10px" }}
                    >
                      {plugin.scope}
                    </span>
                  </div>
                  {plugin.description && (
                    <p className="text-sm mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
                      {plugin.description}
                    </p>
                  )}
                  <p className="font-mono text-xs mt-1" style={{ color: "var(--text-tertiary)", fontSize: "10px" }}>
                    {plugin.id}
                  </p>
                </div>

                {/* 操作 */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {plugin.homepage && (
                    <a
                      href={plugin.homepage}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={14} style={{ color: "var(--text-tertiary)" }} />
                    </a>
                  )}
                  <button
                    onClick={() => handleToggle(plugin)}
                    disabled={toggling === plugin.id}
                    className="transition-opacity disabled:opacity-50"
                    title={plugin.enabled ? "禁用" : "启用"}
                  >
                    {plugin.enabled ? (
                      <ToggleRight size={26} style={{ color: "var(--accent)" }} />
                    ) : (
                      <ToggleLeft size={26} style={{ color: "var(--text-tertiary)" }} />
                    )}
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
