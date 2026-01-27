"use client";

import { useState, useEffect, useCallback } from "react";
import ItemTable from "./ItemTable";
import CsvUpload from "./CsvUpload";
import RefreshButton from "./RefreshButton";

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

export default function Dashboard() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/items");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <main>
      <div className="toolbar">
        <RefreshButton />
        <button
          className="btn btn-outline"
          onClick={() => setShowUpload(!showUpload)}
        >
          {showUpload ? "Hide Upload" : "Upload CSV"}
        </button>
        <span className="text-sm text-secondary">
          {items.length} items
        </span>
      </div>

      {showUpload && (
        <CsvUpload
          onSuccess={() => {
            fetchItems();
            setShowUpload(false);
          }}
        />
      )}

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <p className="text-secondary">Loading...</p>
        </div>
      ) : (
        <ItemTable items={items} />
      )}
    </main>
  );
}
