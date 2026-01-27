"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ItemRow = {
  id: string;
  name?: string | null;
  url: string;
  group?: string | null;
  memo?: string | null;
  status?: string | null;
  last_checked_at?: string | null;
  current_low?: number | null;
  lowest_variant?: string | null;
  low_7d?: number | null;
  low_30d?: number | null;
};

type UploadResult = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
};

const refreshItems = async () => {
  const response = await fetch("/api/items", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load items");
  }
  const data = await response.json();
  return data.items as ItemRow[];
};

export default function DashboardClient() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [scheduleInterval, setScheduleInterval] = useState(10);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await refreshItems();
      setItems(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSelected = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const response = await fetch("/api/items/upload-csv", {
      method: "POST",
      headers: {
        "Content-Type": "text/csv"
      },
      body: text
    });
    const data = (await response.json()) as UploadResult;
    setUploadResult(data);
    await load();
  };

  const enqueue = async (mode: "all" | "selected", reason: "manual" | "scheduled") => {
    await fetch("/api/jobs/enqueue", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode,
        reason,
        itemIds: mode === "selected" ? selected : undefined,
        intervalMinutes: reason === "scheduled" ? scheduleInterval : undefined
      })
    });
    await load();
  };

  const allSelected = useMemo(
    () => items.length > 0 && selected.length === items.length,
    [items.length, selected.length]
  );

  return (
    <>
      <section>
        <h2>CSV 업로드</h2>
        <div className="flex">
          <input
            type="file"
            accept=".csv"
            onChange={(event) => handleUpload(event.target.files?.[0] ?? null)}
          />
          {uploadResult && (
            <span className="muted">
              추가 {uploadResult.inserted}, 업데이트 {uploadResult.updated}, 스킵{" "}
              {uploadResult.skipped}
            </span>
          )}
        </div>
        {uploadResult?.errors?.length ? (
          <ul className="muted">
            {uploadResult.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2>수동 갱신</h2>
        <div className="flex">
          <button className="primary" onClick={() => enqueue("all", "manual")}>
            전체 갱신
          </button>
          <button onClick={() => enqueue("selected", "manual")}>
            선택 갱신
          </button>
          <span className="muted">
            선택된 항목 {selected.length} / {items.length}
          </span>
        </div>
      </section>

      <section>
        <h2>주기 갱신</h2>
        <div className="flex">
          <select
            value={scheduleInterval}
            onChange={(event) => setScheduleInterval(Number(event.target.value))}
          >
            {[5, 10, 30, 60].map((value) => (
              <option key={value} value={value}>
                {value}분
              </option>
            ))}
          </select>
          <button className="primary" onClick={() => enqueue("all", "scheduled")}>
            주기 갱신 등록
          </button>
          <span className="muted">
            {scheduleInterval}분 내에 균등 배치됩니다.
          </span>
        </div>
      </section>

      <section>
        <div className="flex" style={{ justifyContent: "space-between" }}>
          <h2>모니터링 목록</h2>
          <button onClick={load}>{loading ? "로딩 중..." : "새로고침"}</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? [] : items.map((item) => item.id))
                  }
                />
              </th>
              <th>상품</th>
              <th>현재 최저가</th>
              <th>7D 최저</th>
              <th>30D 최저</th>
              <th>상태</th>
              <th>마지막 체크</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={() => toggleSelected(item.id)}
                  />
                </td>
                <td>
                  <a href={`/items/${item.id}`}>{item.name ?? "Untitled"}</a>
                  <div className="muted">{item.url}</div>
                </td>
                <td>{item.current_low ?? "-"}</td>
                <td>{item.low_7d ?? "-"}</td>
                <td>{item.low_30d ?? "-"}</td>
                <td>
                  <span className="tag">{item.status ?? "UNKNOWN"}</span>
                </td>
                <td>{item.last_checked_at ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
