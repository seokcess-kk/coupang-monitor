"use client";

interface CrawlStatusProps {
  pending: number;
  inProgress: number;
  done: number;
  failed: number;
  total: number;
}

export default function CrawlStatus({ pending, inProgress, done, failed, total }: CrawlStatusProps) {
  if (pending === 0 && inProgress === 0) return null;

  const progress = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;

  return (
    <div className="crawl-status">
      <div className="crawl-status-spinner" />
      <div className="crawl-status-content">
        <span className="crawl-status-text">
          크롤링 중... ({done + failed}/{total} 완료)
        </span>
        <div className="crawl-status-bar">
          <div
            className="crawl-status-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      {failed > 0 && (
        <span className="crawl-status-failed">{failed} 실패</span>
      )}
    </div>
  );
}
