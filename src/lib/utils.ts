/**
 * 将 cwd 按 Claude Code 的编码规则编码为 project.id，用于匹配活跃会话。
 * 规则：`:\` → `--`，其余 `\`/`/`/`_` 均 → `-`
 */
export function encodeCwdToProjectId(cwd: string): string {
  return cwd
    .replace(/\\/g, "/")                              // 统一为正斜杠
    .replace(/^([a-zA-Z]):\//,(_, d) => d.toUpperCase() + "--") // D:/ → D--
    .replace(/\//g, "-")                              // 剩余 / → -
    .replace(/_/g, "-");                              // _ → -
}

export function getProjectName(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;
}

export function getProjectDir(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  parts.pop();
  return parts.join(" / ");
}

export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "无记录";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "刚刚";
  if (mins < 60)  return `${mins} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  return `${days} 天前`;
}
