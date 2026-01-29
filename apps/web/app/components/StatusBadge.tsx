interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const cls =
    status === "OK"
      ? "badge-ok"
      : status === "SOLD_OUT"
        ? "badge-sold-out"
        : status === "UNKNOWN"
          ? "badge-unknown"
          : "badge-error";
  return <span className={`badge ${cls}`}>{status}</span>;
}
