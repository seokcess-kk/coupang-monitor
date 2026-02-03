"use client";

import { useState, useRef, useCallback } from "react";

const TEMPLATE_CSV = `name,url,group,memo
(예시) 상품명,https://www.coupang.com/vp/products/123456?itemId=789&vendorItemId=101112,그룹명,메모`;

interface UploadResult {
  created: number;
  skipped: number;
  duplicatesInCsv: number;
  errors: { row: number; message: string }[];
}

interface CsvUploadProps {
  onSuccess?: () => void;
  onCrawlStart?: (enqueued: number) => void;
}

export default function CsvUpload({ onSuccess, onCrawlStart }: CsvUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob(["\uFEFF" + TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pricewatch-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    setResult(null);
    setError(null);

    try {
      const text = await file.text();
      const res = await fetch("/api/items/upload-csv", {
        method: "POST",
        body: text,
        headers: { "Content-Type": "text/csv" },
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Upload failed");
        return;
      }

      const data: UploadResult = await res.json();
      setResult(data);

      // 새로 생성된 items가 있으면 자동 크롤링 시작
      if (data.created > 0) {
        try {
          const enqueueRes = await fetch("/api/jobs/enqueue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "all", reason: "manual" }),
          });
          if (enqueueRes.ok) {
            const enqueueData = await enqueueRes.json();
            if (enqueueData.enqueued > 0) {
              onCrawlStart?.(enqueueData.enqueued);
            }
          }
        } catch {
          // 크롤링 enqueue 실패는 무시 (업로드는 성공)
        }
      }

      onSuccess?.();
    } catch {
      setError("Network error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 12 }}>CSV Upload</h3>
      <div
        className="upload-area"
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        <p>{uploading ? "Uploading..." : "Click to select CSV file"}</p>
        <p className="text-sm text-secondary mt-2">
          Columns: name, url, group, memo
          {" · "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDownloadTemplate();
            }}
            style={{ color: "var(--primary)", textDecoration: "underline" }}
          >
            템플릿 다운로드
          </a>
        </p>
      </div>

      {result && (
        <div className="mt-4">
          <p>Created: <strong>{result.created}</strong></p>
          <p>Skipped (existing): <strong>{result.skipped}</strong></p>
          {result.duplicatesInCsv > 0 && (
            <p>Duplicates in CSV: <strong>{result.duplicatesInCsv}</strong></p>
          )}
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p style={{ color: "var(--danger)" }}>Errors:</p>
              <ul style={{ paddingLeft: 20 }}>
                {result.errors.map((e, i) => (
                  <li key={i} className="text-sm">
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
