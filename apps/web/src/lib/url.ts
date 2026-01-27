export type NormalizedUrl = {
  canonicalUrl: string;
  productId: string;
  itemId?: string;
  vendorItemId?: string;
  itemKey: string;
};

export function normalizeCoupangUrl(input: string): NormalizedUrl | null {
  try {
    const url = new URL(input);
    const match = url.pathname.match(/\/vp\/products\/(\d+)/);
    if (!match) {
      return null;
    }
    const productId = match[1];
    const itemId = url.searchParams.get("itemId") ?? undefined;
    const vendorItemId = url.searchParams.get("vendorItemId") ?? undefined;
    const canonical = new URL(`https://www.coupang.com/vp/products/${productId}`);
    if (itemId) {
      canonical.searchParams.set("itemId", itemId);
    }
    if (vendorItemId) {
      canonical.searchParams.set("vendorItemId", vendorItemId);
    }
    const itemKey = `${productId}:${itemId ?? ""}:${vendorItemId ?? ""}`;
    return {
      canonicalUrl: canonical.toString(),
      productId,
      itemId,
      vendorItemId,
      itemKey
    };
  } catch {
    return null;
  }
}
