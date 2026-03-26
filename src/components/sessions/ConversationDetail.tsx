import { useEffect, useState } from "react";
import { X, User, Bot, Wrench, Brain, ChevronDown, ChevronRight, Loader } from "lucide-react";
import { api } from "@/lib/tauri-api";
import type { ConversationRecord, ContentBlock } from "@/lib/types";

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
          className="px-5 py-2 border-t text-xs font-mono flex gap-4"
          style={{ borderColor: "var(--border)", color: "var(--text-tertiary)", background: "var(--surface-2)" }}
        >
          <span>{messages.length} 条消息</span>
          <span>{records.length} 条记录</span>
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
        {text || <span style={{ color: "var(--text-tertiary)" }}>（空消息）</span>}
      </div>
    </div>
  );
}

function AssistantMessage({ record }: { record: ConversationRecord }) {
  const content = record.message?.content;
  const model = record.message?.model;
  const blocks: ContentBlock[] = typeof content === "string"
    ? [{ type: "text", text: content }]
    : Array.isArray(content) ? content as ContentBlock[] : [];

  return (
    <div className="flex gap-2">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: "rgba(217,113,57,0.12)", border: "1px solid rgba(217,113,57,0.25)" }}
      >
        <Bot size={13} style={{ color: "var(--accent)" }} />
      </div>
      <div className="flex-1 space-y-2">
        {model && (
          <span
            className="inline-block font-mono text-xs px-2 py-0.5 rounded"
            style={{ background: "var(--surface-2)", color: "var(--text-tertiary)", fontSize: "10px" }}
          >
            {model.split("-").slice(-2).join("-")}
          </span>
        )}
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
