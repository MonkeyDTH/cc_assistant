import { CheckCircle, AlertCircle } from "lucide-react";

interface Props {
  status: "idle" | "saved" | "error";
}

export function SaveStatusBadge({ status }: Props) {
  if (status === "saved") {
    return (
      <div className="flex items-center gap-1 text-xs" style={{ color: "#22c55e" }}>
        <CheckCircle size={13} /> 已保存
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex items-center gap-1 text-xs" style={{ color: "#ef4444" }}>
        <AlertCircle size={13} /> 保存失败
      </div>
    );
  }
  return null;
}
