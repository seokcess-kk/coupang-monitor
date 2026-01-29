"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ItemData } from "@/lib/types";
import { formatPrice, formatDateFull as formatDate } from "@/lib/format";
import { StatusBadge } from "@/app/components/StatusBadge";

export default function ItemDetail({ itemId }: { itemId: string }) {
  const [item, setItem] = useState<ItemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchItem() {
      try {
        const res = await fetch(`/api/items/${itemId}`);
        if (!res.ok) {
          setError(res.status === 404 ? "Item not found" : "Failed to load");
          return;
        }
        const data = await res.json();
        setItem(data);
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    fetchItem();
  }, [itemId]);

  if (loading) {
    return <div className="card" style={{ textAlign: "center", padding: 48 }}>Loading...</div>;
  }

  if (error || !item) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        <p style={{ color: "var(--danger)" }}>{error}</p>
        <Link href="/" className="mt-4" style={{ display: "inline-block" }}>Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/">Back to Dashboard</Link>
      </div>

      {/* Summary Card */}
      <div className="card">
        <h2 style={{ marginBottom: 8 }}>{item.name || "Unnamed Item"}</h2>
        <p className="text-sm text-secondary mb-4">
          <a href={item.url} target="_blank" rel="noopener noreferrer">{item.url}</a>
        </p>
        {item.group && <p className="text-sm">Group: {item.group}</p>}
        {item.memo && <p className="text-sm">Memo: {item.memo}</p>}

        <div className="flex gap-4 mt-4" style={{ flexWrap: "wrap" }}>
          <div>
            <span className="text-sm text-secondary">Current Low</span>
            <p className="price" style={{ fontSize: 24, fontWeight: 700 }}>{formatPrice(item.currentLow)}</p>
          </div>
          <div>
            <span className="text-sm text-secondary">7D Low</span>
            <p className="price" style={{ fontSize: 18 }}>{formatPrice(item.low7d)}</p>
          </div>
          <div>
            <span className="text-sm text-secondary">30D Low</span>
            <p className="price" style={{ fontSize: 18 }}>{formatPrice(item.low30d)}</p>
          </div>
          <div>
            <span className="text-sm text-secondary">Status</span>
            <p className="mt-2"><StatusBadge status={item.status} /></p>
          </div>
        </div>
      </div>

      {/* Variants Table */}
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <div style={{ padding: "16px 16px 0" }}>
          <h3>Variants ({item.variants.length})</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Option</th>
              <th>Current Price</th>
              <th>Status</th>
              <th>Last Checked</th>
              <th>Snapshots</th>
            </tr>
          </thead>
          <tbody>
            {item.variants.map((v) => (
              <tr key={v.id}>
                <td>{v.optionKey}</td>
                <td className="price">{formatPrice(v.currentPrice)}</td>
                <td><StatusBadge status={v.currentStatus} /></td>
                <td className="text-sm">{formatDate(v.lastCheckedAt)}</td>
                <td>{v.snapshotCount}</td>
              </tr>
            ))}
            {item.variants.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                  No variants collected yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent Snapshots */}
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <div style={{ padding: "16px 16px 0" }}>
          <h3>Price History (30 days)</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Option</th>
              <th>Price</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {item.snapshots.slice(0, 100).map((s) => (
              <tr key={s.id}>
                <td className="text-sm">{formatDate(s.checkedAt)}</td>
                <td className="text-sm">{s.optionKey}</td>
                <td className="price">{formatPrice(s.price)}</td>
                <td><StatusBadge status={s.statusCode} /></td>
              </tr>
            ))}
            {item.snapshots.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                  No snapshots yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
