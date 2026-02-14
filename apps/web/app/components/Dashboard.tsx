"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ItemTable from "./ItemTable";
import ItemTableSkeleton from "./ItemTableSkeleton";
import CsvUpload from "./CsvUpload";
import CrawlStatus from "./CrawlStatus";
import RefreshButton from "./RefreshButton";
import AddItemModal from "./AddItemModal";
import EditItemModal from "./EditItemModal";
import { ToastProvider, useToast } from "./Toast";
import type { ItemRow } from "@/lib/types";

interface JobStatus {
  pending: number;
  inProgress: number;
  done: number;
  failed: number;
  total: number;
}

function DashboardContent() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [jobStatus, setJobStatus] = useState<JobStatus>({ pending: 0, inProgress: 0, done: 0, failed: 0, total: 0 });
  const [isPolling, setIsPolling] = useState(false);
  const [expectedTotal, setExpectedTotal] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const { showToast } = useToast();

  const fetchItems = useCallback(async () => {
    console.log("[Dashboard] fetchItems called");
    try {
      const res = await fetch("/api/items");
      console.log("[Dashboard] fetch response:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("[Dashboard] items loaded:", data.length);
        setItems(data);
      }
    } catch (err) {
      console.error("[Dashboard] fetch error:", err);
      showToast("Failed to fetch items", "error");
    } finally {
      console.log("[Dashboard] setting loading to false");
      setLoading(false);
    }
  }, [showToast]);

  const fetchJobStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/status");
      if (res.ok) {
        const data: JobStatus = await res.json();
        setJobStatus(data);
        return data;
      }
    } catch {
      // 조용히 실패
    }
    return null;
  }, []);

  // 초기 로드
  useEffect(() => {
    fetchItems();
    fetchJobStatus();
  }, [fetchItems, fetchJobStatus]);

  // 크롤링 중일 때 자동 폴링
  useEffect(() => {
    if ((jobStatus.pending > 0 || jobStatus.inProgress > 0) && !isPolling) {
      setIsPolling(true);
    }

    if (isPolling) {
      pollingRef.current = setInterval(async () => {
        const status = await fetchJobStatus();
        await fetchItems();

        if (status && status.pending === 0 && status.inProgress === 0) {
          setIsPolling(false);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          showToast("크롤링 완료!", "success");
        }
      }, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isPolling, jobStatus.pending, jobStatus.inProgress, fetchJobStatus, fetchItems, showToast]);

  const startPolling = useCallback((enqueued: number) => {
    setExpectedTotal(enqueued);
    setIsPolling(true);
    fetchJobStatus();
  }, [fetchJobStatus]);

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
    if (statusFilter === "ALL") return items;  // UNKNOWN 포함
    if (statusFilter === "PENDING") {
      return items.filter((item) => item.status === "UNKNOWN");
    }
    if (statusFilter === "ERROR") {
      return items.filter(
        (item) => item.status !== "OK" && item.status !== "SOLD_OUT" && item.status !== "UNKNOWN"
      );
    }
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const stats = useMemo(() => ({
    all: items.length,
    pending: items.filter((i) => i.status === "UNKNOWN").length,
    ok: items.filter((i) => i.status === "OK").length,
    sold_out: items.filter((i) => i.status === "SOLD_OUT").length,
    error: items.filter((i) =>
      i.status !== "OK" && i.status !== "SOLD_OUT" && i.status !== "UNKNOWN"
    ).length,
  }), [items]);

  return (
    <main>
      <div className="toolbar" style={{ justifyContent: "space-between", flexWrap: 'wrap' }}>
        <div className="flex gap-2">
          <RefreshButton
            onCrawlStart={startPolling}
            showToast={showToast}
          />
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            + 상품 추가
          </button>
          <button
            className="btn btn-outline"
            onClick={() => setShowUpload(!showUpload)}
          >
            {showUpload ? "닫기" : "CSV 업로드"}
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
            className={`filter-btn ${statusFilter === "PENDING" ? "active" : ""}`}
            onClick={() => setStatusFilter("PENDING")}
          >
            대기 중 ({stats.pending})
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
          onCrawlStart={(enqueued) => {
            startPolling(enqueued);
            showToast("크롤링을 시작합니다...", "success");
          }}
        />
      )}

      {isPolling && expectedTotal > 0 && (
        <CrawlStatus
          pending={jobStatus.pending}
          inProgress={jobStatus.inProgress}
          done={Math.max(0, expectedTotal - jobStatus.pending - jobStatus.inProgress)}
          failed={jobStatus.failed}
          total={expectedTotal}
        />
      )}

      {loading ? (
        <ItemTableSkeleton />
      ) : (
        <ItemTable
          items={filteredItems}
          onDelete={handleDelete}
          onEdit={(item) => setEditingItem(item)}
        />
      )}

      <AddItemModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          fetchItems();
          showToast("상품이 추가되었습니다", "success");
        }}
      />

      <EditItemModal
        isOpen={!!editingItem}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSuccess={() => {
          fetchItems();
          showToast("상품 정보가 수정되었습니다", "success");
        }}
      />
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
