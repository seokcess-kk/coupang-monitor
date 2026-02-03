"use client";

import Link from "next/link";
import { useState } from "react";
import type { ItemRow } from "@/lib/types";
import { formatPrice, formatDate } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

export default function ItemTable({
  items,
  onDelete
}: {
  items: ItemRow[];
  onDelete: (id: string) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteClick = async (id: string, name: string | null) => {
    const confirmed = window.confirm(
      `"${name || "Unnamed"}" 상품을 삭제하시겠습니까?\n모든 가격 기록도 함께 삭제됩니다.`
    );

    if (!confirmed) return;

    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  if (items.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        <p className="text-secondary">No items yet. Upload a CSV to get started.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "auto" }}>
      <table style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "36%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "8%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Name</th>
            <th style={{ textAlign: "center" }}>Current Low</th>
            <th style={{ textAlign: "center" }}>7D Low</th>
            <th style={{ textAlign: "center" }}>30D Low</th>
            <th style={{ textAlign: "center" }}>Lowest Option</th>
            <th style={{ textAlign: "center" }}>Status</th>
            <th style={{ textAlign: "center" }}>Last Checked</th>
            <th style={{ textAlign: "center" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.name}>
                <div style={{ display: "flex", alignItems: "center", overflow: "hidden" }}>
                  <Link
                    href={`/items/${item.id}`}
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "block"
                    }}
                  >
                    {item.name || "Unnamed"}
                  </Link>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="icon-link"
                    title="Open in Coupang"
                    style={{ flexShrink: 0 }}
                  >
                    🔗
                  </a>
                  {item.group && (
                    <span className="text-sm text-secondary ml-2" style={{ flexShrink: 0 }}> [{item.group}]</span>
                  )}
                </div>
              </td>
              <td className="price" style={{ whiteSpace: "nowrap", textAlign: "center" }}>{formatPrice(item.currentLow)}</td>
              <td className="price" style={{ whiteSpace: "nowrap", textAlign: "center" }}>{formatPrice(item.low7d)}</td>
              <td className="price" style={{ whiteSpace: "nowrap", textAlign: "center" }}>{formatPrice(item.low30d)}</td>
              <td className="text-sm" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" }} title={item.lowestVariant || "-"}>{item.lowestVariant || "-"}</td>
              <td style={{ whiteSpace: "nowrap", textAlign: "center" }}><StatusBadge status={item.status} /></td>
              <td className="text-sm" style={{ whiteSpace: "nowrap", textAlign: "center" }}>{formatDate(item.lastCheckedAt)}</td>
              <td style={{ whiteSpace: "nowrap", textAlign: "center" }}>
                <button
                  onClick={() => handleDeleteClick(item.id, item.name)}
                  disabled={deletingId === item.id}
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    backgroundColor: deletingId === item.id ? "#ccc" : "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: deletingId === item.id ? "not-allowed" : "pointer",
                  }}
                >
                  {deletingId === item.id ? "삭제 중..." : "삭제"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
