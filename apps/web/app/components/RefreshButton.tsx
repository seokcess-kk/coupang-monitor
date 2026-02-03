"use client";

import { useState } from "react";

interface RefreshButtonProps {
  onCrawlStart?: () => void;
  showToast?: (message: string, type: "success" | "error") => void;
}

export default function RefreshButton({ onCrawlStart, showToast }: RefreshButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/jobs/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all", reason: "manual" }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult(`Enqueued: ${data.enqueued}, Skipped: ${data.skipped}`);

        // 작업이 enqueue된 경우에만 콜백 호출
        if (data.enqueued > 0) {
          onCrawlStart?.();
          showToast?.("크롤링을 시작합니다...", "success");
        }
      } else {
        setResult(data.error || "Failed");
      }
    } catch {
      setResult("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2" style={{ alignItems: "center" }}>
      <button
        className="btn btn-primary"
        onClick={handleRefresh}
        disabled={loading}
      >
        {loading ? "Refreshing..." : "Refresh All"}
      </button>
      {result && <span className="text-sm text-secondary">{result}</span>}
    </div>
  );
}
