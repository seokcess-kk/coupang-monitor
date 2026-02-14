"use client";

import { useState } from "react";

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddItemModal({ isOpen, onClose, onSuccess }: AddItemModalProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, name, group, memo }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to add item");
        return;
      }

      // Reset form and close
      setUrl("");
      setName("");
      setGroup("");
      setMemo("");
      onSuccess();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>상품 추가</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="url">쿠팡 URL *</label>
            <input
              id="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.coupang.com/vp/products/..."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">상품명 (선택)</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="자동으로 수집됩니다"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="group">그룹 (선택)</label>
              <input
                id="group"
                type="text"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                placeholder="예: 생필품"
              />
            </div>

            <div className="form-group">
              <label htmlFor="memo">메모 (선택)</label>
              <input
                id="memo"
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 정기 구매용"
              />
            </div>
          </div>

          {error && (
            <div className="form-error">{error}</div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "추가 중..." : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
