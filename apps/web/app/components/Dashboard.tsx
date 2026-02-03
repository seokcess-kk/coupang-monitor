"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ItemTable from "./ItemTable";
import ItemTableSkeleton from "./ItemTableSkeleton";
import CsvUpload from "./CsvUpload";
import CrawlStatus from "./CrawlStatus";
import RefreshButton from "./RefreshButton";
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
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [jobStatus, setJobStatus] = useState<JobStatus>({ pending: 0, inProgress: 0, done: 0, failed: 0, total: 0 });
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
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

  const startPolling = useCallback(() => {
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
          onCrawlStart={() => {
            startPolling();
            showToast("크롤링을 시작합니다...", "success");
          }}
        />
      )}

      {isPolling && (
        <CrawlStatus
          pending={jobStatus.pending}
          inProgress={jobStatus.inProgress}
          done={jobStatus.done}
          failed={jobStatus.failed}
          total={jobStatus.total}
        />
      )}

      {loading ? (
        <ItemTableSkeleton />
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
