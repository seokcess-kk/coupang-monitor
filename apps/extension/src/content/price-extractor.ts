export interface PriceResult {
  price: number | null;
  statusCode: string;
  rawPriceText: string;
}

const UNIT_PRICE_RE = /\d+[gml]당|\d+ml당|\d+g당/i;
const KRW_PRICE_RE = /[\d,]+/;

export function parseKrwPrice(text: string): number | null {
  if (!text || text.trim() === "") return null;

  const trimmed = text.trim();

  // Exclude percentages
  if (trimmed.includes("%")) return null;

  // Exclude unit prices (100g당, 100ml당, etc.)
  if (UNIT_PRICE_RE.test(trimmed)) return null;

  const match = trimmed.match(KRW_PRICE_RE);
  if (!match) return null;

  const num = parseInt(match[0].replace(/,/g, ""), 10);
  if (isNaN(num) || num === 0) return null;

  return num;
}

export function extractPrice(html: string): PriceResult {
  // Check for sold out
  if (html.includes("품절") || html.includes("일시품절")) {
    return { price: null, statusCode: "SOLD_OUT", rawPriceText: "" };
  }

  // Priority A: Look for "쿠팡판매가" label
  const coupangSalePriceIdx = html.indexOf("쿠팡판매가");
  if (coupangSalePriceIdx !== -1) {
    // Find price near this label
    const afterLabel = html.slice(coupangSalePriceIdx);
    const prices = extractAllPrices(afterLabel);
    if (prices.length > 0) {
      return {
        price: prices[0].value,
        statusCode: "OK",
        rawPriceText: prices[0].text,
      };
    }
  }

  // Priority B: Use final displayed price in price block
  // First try <strong> tagged prices (prominent/discounted prices)
  const strongPrices = extractStrongPrices(html);
  if (strongPrices.length > 0) {
    const finalStrong = strongPrices[strongPrices.length - 1];
    return {
      price: finalStrong.value,
      statusCode: "OK",
      rawPriceText: finalStrong.text,
    };
  }

  // Fallback: all prices
  const allPrices = extractAllPrices(html);
  const validPrices = allPrices.filter((p) => p.value !== null);

  if (validPrices.length === 0) {
    return { price: null, statusCode: "FAIL_SELECTOR", rawPriceText: "" };
  }

  const finalPrice = validPrices[validPrices.length - 1];
  return {
    price: finalPrice.value,
    statusCode: "OK",
    rawPriceText: finalPrice.text,
  };
}

interface PriceCandidate {
  value: number;
  text: string;
}

function extractStrongPrices(html: string): PriceCandidate[] {
  const results: PriceCandidate[] = [];
  const pattern = /<strong[^>]*>([\d,]+)<\/strong>\s*원?/g;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    const contextStart = Math.max(0, match.index - 30);
    const context = html.slice(contextStart, match.index + match[0].length);
    if (UNIT_PRICE_RE.test(context)) continue;
    if (context.includes("쿠폰할인") || context.includes("쿠폰")) continue;

    const value = parseKrwPrice(match[1]);
    if (value !== null) {
      results.push({ value, text: match[0] });
    }
  }

  return results;
}

function extractAllPrices(html: string): PriceCandidate[] {
  const results: PriceCandidate[] = [];

  // Match patterns like: <strong>14,650</strong>원 or 14,650원 or ">14,900<"
  const pricePatterns = [
    // Pattern: <strong>NUMBER</strong>원
    /<strong[^>]*>([\d,]+)<\/strong>\s*원/g,
    // Pattern: NUMBER원 (standalone)
    />([\d,]+)\s*원</g,
    // Pattern: NUMBER원 in text
    /([\d,]+)\s*원/g,
  ];

  const seen = new Set<number>();

  for (const pattern of pricePatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const text = match[0];
      // Skip unit prices
      const contextStart = Math.max(0, match.index - 20);
      const context = html.slice(contextStart, match.index + match[0].length);
      if (UNIT_PRICE_RE.test(context)) continue;
      // Skip coupon-related prices
      if (context.includes("쿠폰할인") || context.includes("쿠폰")) continue;

      const value = parseKrwPrice(match[1]);
      if (value !== null && !seen.has(value)) {
        seen.add(value);
        results.push({ value, text });
      }
    }
  }

  return results;
}

// DOM-based extraction for actual content script usage
export function extractPriceFromDOM(document: Document): PriceResult {
  console.log("[PriceWatch] Starting price extraction...");
  console.log("[PriceWatch] Page URL:", document.location?.href);
  console.log("[PriceWatch] Document ready state:", document.readyState);

  // Check for sold out - expanded selector list
  const soldOutEl = document.querySelector(
    ".oos-label, .out-of-stock, [class*='sold-out'], [class*='soldout'], .prod-not-available, [class*='품절']"
  );
  if (soldOutEl) {
    console.log("[PriceWatch] Found sold out element:", soldOutEl.className);
    return { price: null, statusCode: "SOLD_OUT", rawPriceText: "" };
  }

  // Check purchase button for sold out text
  const purchaseBtn = document.querySelector(".prod-buy-btn, .buy-button, [class*='purchase'], [class*='buy-btn']");
  if (purchaseBtn) {
    const btnText = purchaseBtn.textContent ?? "";
    console.log("[PriceWatch] Purchase button text:", btnText.substring(0, 50));
    if (btnText.includes("품절") || btnText.includes("일시품절") || btnText.includes("재입고")) {
      return { price: null, statusCode: "SOLD_OUT", rawPriceText: "" };
    }
  } else {
    console.log("[PriceWatch] No purchase button found");
  }

  // Priority A: Look for 쿠팡판매가
  const allElements = document.querySelectorAll("*");
  for (const el of allElements) {
    if (el.children.length === 0 && el.textContent?.includes("쿠팡판매가")) {
      // Look for price in nearby sibling/parent
      const parent = el.closest("[class*='price']") ?? el.parentElement;
      if (parent) {
        const priceEl = parent.querySelector("strong, [class*='total-price']");
        if (priceEl) {
          const price = parseKrwPrice(priceEl.textContent ?? "");
          if (price !== null) {
            return {
              price,
              statusCode: "OK",
              rawPriceText: priceEl.textContent ?? "",
            };
          }
        }
      }
    }
  }

  // Priority B: Find main price block - expanded selector list
  // 2026-02 기준 쿠팡 DOM 구조 반영
  const priceSelectors = [
    // 최신 쿠팡 선택자 (2026-02 기준, 최우선)
    ".price-container .final-price-amount",
    ".price-container .sales-price-amount",
    ".final-price .final-price-amount",
    ".sales-price .sales-price-amount",
    ".final-price-amount",
    ".sales-price-amount",
    ".price-amount.final-price-amount",
    ".price-amount.sales-price-amount",
    // 기존 쿠팡 선택자 (레거시)
    ".prod-sale-price .total-price strong",
    ".prod-sale-price strong",
    ".total-price strong",
    "[class*='sale-price'] strong",
    ".prod-price strong",
    "[class*='final-price'] strong",
    "[class*='finalPrice'] strong",
    ".prod-coupon-price .total-price strong",
    ".prod-origin-price strong",
    "[class*='price-value']",
    "[class*='priceValue']",
    ".prod-pdd-price strong",
    ".price strong",
    "strong.price",
  ];

  console.log("[PriceWatch] Trying", priceSelectors.length, "price selectors...");

  for (const selector of priceSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      console.log("[PriceWatch] Found element with selector:", selector, "Text:", el.textContent?.substring(0, 30));
      const price = parseKrwPrice(el.textContent ?? "");
      if (price !== null) {
        console.log("[PriceWatch] Successfully extracted price:", price);
        return {
          price,
          statusCode: "OK",
          rawPriceText: el.textContent ?? "",
        };
      }
    }
  }

  // Log available elements for debugging
  const bodyText = document.body?.innerText?.substring(0, 500);
  console.log("[PriceWatch] FAIL_SELECTOR - Page body preview:", bodyText);
  console.log("[PriceWatch] All strong elements:", document.querySelectorAll("strong").length);

  return { price: null, statusCode: "FAIL_SELECTOR", rawPriceText: "" };
}
