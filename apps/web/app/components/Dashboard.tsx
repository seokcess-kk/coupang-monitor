"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import ItemTable from "./ItemTable";
import CsvUpload from "./CsvUpload";
import RefreshButton from "./RefreshButton";
import { ToastProvider, useToast } from "./Toast";
import type { ItemRow } from "@/lib/types";

function DashboardContent() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const { showToast } = useToast();

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/items");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {
      showToast("Failed to fetch items", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDelete = async (id: string) => {
    // Optimistic update
    const previousItems = [...items];
    setItems((prev) => prev.filter((item) => item.id !== id));

    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showToast("Item deleted", "success");
      } else {
        throw new Error("Failed to delete");
      }
    } catch {
      // Revert if failed
      setItems(previousItems);
      showToast("Failed to delete item", "error");
    }
  };

  const filteredItems = useMemo(() => {
    if (statusFilter === "ALL") return items;
    if (statusFilter === "ERROR") {
      return items.filter(
        (item) => item.status !== "OK" && item.status !== "SOLD_OUT"
      );
    }
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const stats = useMemo(() => {
    return {
      all: items.length,
      ok: items.filter((i) => i.status === "OK").length,
      sold_out: items.filter((i) => i.status === "SOLD_OUT").length,
      error: items.filter((i) => i.status !== "OK" && i.status !== "SOLD_OUT")
        .length,
    };
  }, [items]);

  return (
    <main>
      <div className="toolbar" style={{ justifyContent: "space-between", flexWrap: 'wrap' }}>
        <div className="flex gap-2">
          <RefreshButton />
          <button
            className="btn btn-outline"
            onClick={() => setShowUpload(!showUpload)}
          >
            {showUpload ? "Hide Upload" : "Upload CSV"}
          </button>
        </div>

        <div className="filter-bar">
          <button
            className={`filter-btn ${statusFilter === "ALL" ? "active" : ""}`}
            onClick={() => setStatusFilter("ALL")}
          >
            전체 ({stats.all})
          </button>
          <button
            className={`filter-btn ${statusFilter === "OK" ? "active" : ""}`}
            onClick={() => setStatusFilter("OK")}
          >
            정상 ({stats.ok})
          </button>
          <button
            className={`filter-btn ${statusFilter === "SOLD_OUT" ? "active" : ""}`}
            onClick={() => setStatusFilter("SOLD_OUT")}
          >
            품절 ({stats.sold_out})
          </button>
          <button
            className={`filter-btn ${statusFilter === "ERROR" ? "active" : ""}`}
            onClick={() => setStatusFilter("ERROR")}
          >
            에러 ({stats.error})
          </button>
        </div>
      </div>

      {showUpload && (
        <CsvUpload
          onSuccess={() => {
            fetchItems();
            setShowUpload(false);
            showToast("Items uploaded successfully", "success");
          }}
        />
      )}

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <p className="text-secondary">Loading...</p>
        </div>
      ) : (
        <ItemTable items={filteredItems} onDelete={handleDelete} />
      )}
    </main>
  );
}

export default function Dashboard() {
  return (
    <ToastProvider>
      <DashboardContent />
    </ToastProvider>
  );
}
