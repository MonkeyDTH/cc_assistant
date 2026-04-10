import { useEffect, useState } from "react";
import { X, User, Bot, Wrench, Brain, ChevronDown, ChevronRight, Loader } from "lucide-react";
import { api } from "@/lib/tauri-api";
import type { ConversationRecord, ContentBlock } from "@/lib/types";

interface UsageTokens {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

// 根据模型名估算费用（美元/M tokens，含缓存定价）
function estimateCost(model: string | null | undefined, usage: UsageTokens): number {
  // 各模型定价（$/M tokens）
  let inputPrice = 3, outputPrice = 15, cacheWritePrice = 3.75, cacheReadPrice = 0.30;
  if (model?.includes("opus")) {
    inputPrice = 15; outputPrice = 75; cacheWritePrice = 18.75; cacheReadPrice = 1.50;
  } else if (model?.includes("haiku")) {
    inputPrice = 0.8; outputPrice = 4; cacheWritePrice = 1.00; cacheReadPrice = 0.08;
  }
  return (
    usage.input_tokens * inputPrice +
    usage.output_tokens * outputPrice +
    (usage.cache_creation_input_tokens ?? 0) * cacheWritePrice +
    (usage.cache_read_input_tokens ?? 0) * cacheReadPrice
  ) / 1_000_000;
}

function formatCost(usd: number): string {
  if (usd < 0.001) return `<$0.001`;
  if (usd < 0.01)  return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

interface Props {
  projectId: string;
  sessionId: string;
  firstMessage: string | null;
  onClose: () => void;
}

export function ConversationDetail({ projectId, sessionId, firstMessage, onClose }: Props) {
  const [records, setRecords] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.readConversation(projectId, sessionId)
      .then(setRecords)
      .finally(() => setLoading(false));
  }, [projectId, sessionId]);

  // 只展示 user 和 assistant 消息，过滤 progress/snapshot
  const messages = records.filter((r) => r.type === "user" || r.type === "assistant");

  // 计算总 token 和估算费用（含缓存）
  // 去重：tool_use 链中同一 API 响应产生多条 assistant 记录，parent 也是 assistant，
  // 每条携带相同 usage，只取链起点（parent uuid 不是 assistant）避免重复计算。
  const assistantUuids = new Set(
    records.filter((r) => r.type === "assistant").map((r) => r.uuid)
  );
  const tokenStats = records.reduce(
    (acc, r) => {
      if (r.type !== "assistant") return acc;
      // 跳过父节点也是 assistant 的记录（同一 API 调用的后续 tool_use）
      if (r.parentUuid && assistantUuids.has(r.parentUuid)) return acc;
      const usage = r.message?.usage;
      if (usage) {
        acc.input       += usage.input_tokens;
        acc.output      += usage.output_tokens;
        acc.cacheWrite  += usage.cache_creation_input_tokens ?? 0;
        acc.cacheRead   += usage.cache_read_input_tokens ?? 0;
        if (!acc.model) acc.model = r.message?.model ?? null;
      }
      return acc;
    },
    { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, model: null as string | null }
  );
  const hasTokens = tokenStats.input + tokenStats.output + tokenStats.cacheWrite + tokenStats.cacheRead > 0;
  const totalCost = hasTokens
    ? estimateCost(tokenStats.model, {
        input_tokens: tokenStats.input,
        output_tokens: tokenStats.output,
        cache_creation_input_tokens: tokenStats.cacheWrite,
        cache_read_input_tokens: tokenStats.cacheRead,
      })
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--surface)" }}>
      {/* 详情头 */}
      <div
        className="px-5 py-3 border-b flex items-center gap-3 flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface-card)" }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {firstMessage ?? "会话详情"}
          </p>
          <p className="font-mono text-xs mt-0.5" style={{ color: "var(--text-tertiary)", fontSize: "10px" }}>
            {sessionId}
          </p>
        </div>
        <button onClick={onClose} className="flex-shrink-0">
          <X size={16} style={{ color: "var(--text-tertiary)" }} />
        </button>
      </div>

      {/* 消息时间线 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2" style={{ color: "var(--text-tertiary)" }}>
            <Loader size={16} className="animate-spin" /> 加载中…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm" style={{ color: "var(--text-tertiary)" }}>
            暂无消息记录
          </div>
        ) : (
          messages.map((record) =>
            record.type === "user"
              ? <UserMessage key={record.uuid} record={record} />
              : <AssistantMessage key={record.uuid} record={record} />
          )
        )}
      </div>

      {/* 底部统计 */}
      {!loading && (
        <div
          className="px-5 py-2 border-t text-xs font-mono flex items-center gap-4 flex-wrap"
          style={{ borderColor: "var(--border)", color: "var(--text-tertiary)", background: "var(--surface-2)" }}
        >
          <span>{messages.length} 条消息</span>
          {totalCost !== null && (
            <>
              <span style={{ color: "var(--border)" }}>·</span>
              <span title={[
                `输入: ${tokenStats.input}`,
                `输出: ${tokenStats.output}`,
                tokenStats.cacheWrite > 0 ? `缓存写入: ${tokenStats.cacheWrite}` : "",
                tokenStats.cacheRead  > 0 ? `缓存命中: ${tokenStats.cacheRead}` : "",
              ].filter(Boolean).join(" | ")}>
                ↑{formatTokens(tokenStats.input)} ↓{formatTokens(tokenStats.output)}
                {tokenStats.cacheRead > 0 && (
                  <span style={{ opacity: 0.7 }}> ⚡{formatTokens(tokenStats.cacheRead)}</span>
                )}
              </span>
              <span style={{ color: "var(--border)" }}>·</span>
              <span
                className="px-1.5 py-0.5 rounded"
                style={{ background: "rgba(217,113,57,0.10)", color: "var(--accent)", fontWeight: 500 }}
                title="按模型官方定价估算（含缓存），仅供参考"
              >
                ≈ {formatCost(totalCost)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function UserMessage({ record }: { record: ConversationRecord }) {
  const content = record.message?.content;
  const text = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.filter((b) => (b as ContentBlock).type === "text").map((b) => (b as { type: "text"; text: string }).text).join("\n")
      : "";

  // 内容为空时不渲染
  if (!text.trim()) return null;

  return (
    <div className="flex gap-2">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <User size={13} style={{ color: "var(--text-secondary)" }} />
      </div>
      <div
        className="flex-1 rounded-xl px-4 py-3 text-sm"
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          lineHeight: "1.6",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function AssistantMessage({ record }: { record: ConversationRecord }) {
  const content = record.message?.content;
  const model = record.message?.model;
  const usage = record.message?.usage;
  const blocks: ContentBlock[] = typeof content === "string"
    ? [{ type: "text", text: content }]
    : Array.isArray(content) ? content as ContentBlock[] : [];

  // 无有效内容时不渲染（如纯空字符串的 text block）
  const hasContent = blocks.some((b) =>
    b.type === "thinking" || b.type === "tool_use" || b.type === "tool_result" ||
    (b.type === "text" && b.text?.trim())
  );
  if (!hasContent) return null;

  return (
    <div className="flex gap-2">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: "rgba(217,113,57,0.12)", border: "1px solid rgba(217,113,57,0.25)" }}
      >
        <Bot size={13} style={{ color: "var(--accent)" }} />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {model && (
            <span
              className="font-mono text-xs px-2 py-0.5 rounded"
              style={{ background: "var(--surface-2)", color: "var(--text-tertiary)", fontSize: "10px" }}
            >
              {model.split("-").slice(-2).join("-")}
            </span>
          )}
          {usage && (
            <span
              className="font-mono text-xs px-2 py-0.5 rounded"
              style={{ background: "var(--surface-2)", color: "var(--text-tertiary)", fontSize: "10px" }}
              title={[
                `输入: ${usage.input_tokens}`,
                `输出: ${usage.output_tokens}`,
                usage.cache_creation_input_tokens ? `缓存写入: ${usage.cache_creation_input_tokens}` : "",
                usage.cache_read_input_tokens ? `缓存命中: ${usage.cache_read_input_tokens}` : "",
              ].filter(Boolean).join(" | ")}
            >
              ↑{formatTokens(usage.input_tokens)} ↓{formatTokens(usage.output_tokens)}
              {(usage.cache_read_input_tokens ?? 0) > 0 && (
                <> ⚡{formatTokens(usage.cache_read_input_tokens!)}</>
              )}
              {" · "}
              {formatCost(estimateCost(model, usage))}
            </span>
          )}
        </div>
        {blocks.map((block, i) => (
          <MessageBlock key={i} block={block} />
        ))}
      </div>
    </div>
  );
}

function MessageBlock({ block }: { block: ContentBlock }) {
  const [open, setOpen] = useState(false);

  if (block.type === "thinking") {
    return (
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: "1px solid rgba(217,113,57,0.15)", background: "rgba(217,113,57,0.04)" }}
      >
        <button
          className="w-full px-3 py-2 flex items-center gap-2 text-xs"
          onClick={() => setOpen((v) => !v)}
          style={{ color: "var(--accent)" }}
        >
          <Brain size={12} />
          <span className="font-medium">思考过程</span>
          <span className="flex-1" />
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {open && (
          <div
            className="px-4 py-3 text-xs border-t"
            style={{
              borderColor: "rgba(217,113,57,0.15)",
              color: "var(--text-secondary)",
              whiteSpace: "pre-wrap",
              lineHeight: "1.7",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            {block.thinking}
          </div>
        )}
      </div>
    );
  }

  if (block.type === "tool_use") {
    return (
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}
      >
        <button
          className="w-full px-3 py-2 flex items-center gap-2 text-xs"
          onClick={() => setOpen((v) => !v)}
          style={{ color: "var(--text-secondary)" }}
        >
          <Wrench size={12} />
          <span className="font-mono font-medium">{block.name}</span>
          <span className="flex-1" />
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {open && (
          <pre
            className="px-4 py-3 text-xs border-t overflow-x-auto"
            style={{
              borderColor: "var(--border)",
              color: "var(--editor-text)",
              background: "var(--editor-bg)",
              fontSize: "11px",
              lineHeight: "1.6",
            }}
          >
            {JSON.stringify(block.input, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (block.type === "tool_result") {
    const resultText = typeof block.content === "string"
      ? block.content
      : JSON.stringify(block.content, null, 2);
    return (
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}
      >
        <button
          className="w-full px-3 py-2 flex items-center gap-2 text-xs"
          onClick={() => setOpen((v) => !v)}
          style={{ color: "var(--text-tertiary)" }}
        >
          <Wrench size={12} />
          <span className="font-mono">tool_result</span>
          <span className="flex-1" />
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {open && (
          <pre
            className="px-4 py-3 text-xs border-t overflow-x-auto"
            style={{
              borderColor: "var(--border)",
              color: "var(--editor-text)",
              background: "var(--editor-bg)",
              fontSize: "11px",
              lineHeight: "1.6",
            }}
          >
            {resultText.length > 2000 ? resultText.slice(0, 2000) + "\n…（内容已截断）" : resultText}
          </pre>
        )}
      </div>
    );
  }

  // text block
  if (block.type === "text") {
    return (
      <div
        className="rounded-xl px-4 py-3 text-sm"
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          lineHeight: "1.7",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {block.text}
      </div>
    );
  }

  return null;
}
