export interface NormalizedUrl {
  url: string;
  dedupeKey: string;
  productId: string;
  itemId: string;
  vendorItemId: string;
}

const TRACKING_PARAMS = new Set([
  "q",
  "searchId",
  "sourceType",
  "itemsCount",
  "searchRank",
  "rank",
  "traceId",
  "isAddedCart",
]);

const PRODUCT_PATH_RE = /\/v[pm]\/products\/(\d+)/;

export function normalizeUrl(rawUrl: string): NormalizedUrl {
  let urlStr = rawUrl.trim();

  // Upgrade http to https
  if (urlStr.startsWith("http://")) {
    urlStr = "https://" + urlStr.slice(7);
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  // Validate coupang domain
  const hostname = parsed.hostname;
  if (
    hostname !== "www.coupang.com" &&
    hostname !== "m.coupang.com" &&
    hostname !== "coupang.com"
  ) {
    throw new Error(`Not a Coupang URL: ${rawUrl}`);
  }

  // Extract productId from path
  const pathMatch = parsed.pathname.match(PRODUCT_PATH_RE);
  if (!pathMatch || !pathMatch[1]) {
    throw new Error(`Cannot extract productId from URL: ${rawUrl}`);
  }
  const productId = pathMatch[1];

  // Extract itemId
  const itemId = parsed.searchParams.get("itemId");
  if (!itemId) {
    throw new Error(`Missing itemId in URL: ${rawUrl}`);
  }

  // Extract vendorItemId (optional)
  const vendorItemId = parsed.searchParams.get("vendorItemId") ?? "";

  // Build canonical URL
  const canonicalUrl = `https://www.coupang.com/vp/products/${productId}?itemId=${itemId}&vendorItemId=${vendorItemId}`;

  // Build dedupe key
  const dedupeKey = `${productId}:${itemId}:${vendorItemId}`;

  return {
    url: canonicalUrl,
    dedupeKey,
    productId,
    itemId,
    vendorItemId,
  };
}
