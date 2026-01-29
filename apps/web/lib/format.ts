export function formatPrice(price: number | null): string {
  if (price === null) return "-";
  return price.toLocaleString("ko-KR") + "원";
}

export function formatPriceNumber(price: number): string {
  return price.toLocaleString("ko-KR");
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateFull(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("ko-KR");
}
