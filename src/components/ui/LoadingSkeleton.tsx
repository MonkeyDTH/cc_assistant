interface Props {
  count?: number;
  height?: string;
  className?: string;
}

export function LoadingSkeleton({ count = 3, height = "h-20", className = "" }: Props) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`${height} rounded-xl animate-pulse`}
          style={{ background: "var(--surface-2)" }}
        />
      ))}
    </div>
  );
}
