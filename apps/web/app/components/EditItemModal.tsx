"use client";

import { useState, useEffect } from "react";

interface EditItemModalProps {
  isOpen: boolean;
  item: {
    id: string;
    name: string | null;
    group: string | null;
    memo: string | null;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditItemModal({ isOpen, item, onClose, onSuccess }: EditItemModalProps) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setName(item.name || "");
      setGroup(item.group || "");
      setMemo(item.memo || "");
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, group, memo }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to update item");
        return;
      }

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
          <h2>상품 정보 수정</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="edit-name">상품명</label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="상품 이름"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="edit-group">그룹</label>
              <input
                id="edit-group"
                type="text"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                placeholder="예: 생필품"
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-memo">메모</label>
              <input
                id="edit-memo"
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
              {loading ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
