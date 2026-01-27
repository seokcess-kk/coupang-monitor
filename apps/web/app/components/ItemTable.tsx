"use client";

import Link from "next/link";

interface ItemRow {
  id: string;
  name: string | null;
  url: string;
  group: string | null;
  currentLow: number | null;
  lowestVariant: string | null;
  low7d: number | null;
  low30d: number | null;
  lastCheckedAt: string | null;
  status: string;
  variantCount: number;
}

function formatPrice(price: number | null): string {
  if (price === null) return "-";
  return price.toLocaleString("ko-KR") + "원";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: string) {
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

export default function ItemTable({ items }: { items: ItemRow[] }) {
  if (items.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        <p className="text-secondary">No items yet. Upload a CSV to get started.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Current Low</th>
            <th>7D Low</th>
            <th>30D Low</th>
            <th>Lowest Option</th>
            <th>Status</th>
            <th>Variants</th>
            <th>Last Checked</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <Link href={`/items/${item.id}`}>
                  {item.name || "Unnamed"}
                </Link>
                {item.group && (
                  <span className="text-sm text-secondary ml-2"> [{item.group}]</span>
                )}
              </td>
              <td className="price">{formatPrice(item.currentLow)}</td>
              <td className="price">{formatPrice(item.low7d)}</td>
              <td className="price">{formatPrice(item.low30d)}</td>
              <td className="text-sm">{item.lowestVariant || "-"}</td>
              <td>{statusBadge(item.status)}</td>
              <td>{item.variantCount}</td>
              <td className="text-sm">{formatDate(item.lastCheckedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
