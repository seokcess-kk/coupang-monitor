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
