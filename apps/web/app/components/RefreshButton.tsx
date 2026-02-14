"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Progress {
  running: boolean;
  total?: number;
  completed?: number;
  failed?: number;
  elapsed?: number;
  lastJob?: {
    success: number;
    failed: number;
    total: number;
  };
  error?: string;
}

export default function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const pollProgress = useCallback(async () => {
    try {
      const res = await fetch("/api/scraper/progress");
      const data: Progress = await res.json();
      setProgress(data);

      if (data.running) {
        // Continue polling
        pollRef.current = setTimeout(pollProgress, 1000);
      } else {
        // Job finished
        setLoading(false);
        if (data.lastJob) {
          setResult(`완료: ${data.lastJob.success}/${data.lastJob.total}`);
        }
      }
    } catch {
      setLoading(false);
      setResult("연결 실패");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearTimeout(pollRef.current);
      }
    };
  }, []);

  async function handleRefresh() {
    setLoading(true);
    setResult(null);
    setProgress(null);

    try {
      const res = await fetch("/api/scraper/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoading(false);
        if (data.error?.includes("Chrome")) {
          setResult("Chrome 디버그 모드 필요");
        } else if (data.error?.includes("connect")) {
          setResult("스크래퍼 서버 미실행");
        } else {
          setResult(data.error || "실패");
        }
        return;
      }

      // Start polling for progress
      setResult("수집 중...");
      pollProgress();
    } catch {
      setLoading(false);
      setResult("스크래퍼 서버에 연결할 수 없습니다");
    }
  }

  const progressText = progress?.running
    ? `${progress.completed || 0}/${progress.total || 0}`
    : null;

  return (
    <div className="flex gap-2" style={{ alignItems: "center" }}>
      <button
        className="btn btn-primary"
        onClick={handleRefresh}
        disabled={loading}
      >
        {loading ? (progressText ? `수집 중 (${progressText})` : "시작 중...") : "전체 수집"}
      </button>
      {result && !loading && (
        <span className="text-sm text-secondary">{result}</span>
      )}
    </div>
  );
}
