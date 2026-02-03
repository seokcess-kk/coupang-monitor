import { extractPriceFromDOM, type PriceResult } from "./price-extractor";
import { extractProductName } from "./name-extractor";
import { buildOptionKey, detectOptionGroups, generateOptionCombinations, getVariantsForRun } from "./option-iterator";
import type { ScrapeResult } from "../types";

interface ScrapeMessage {
  type: "START_SCRAPE";
  variantCursor: number;
  variantsPerRun: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Random debounce between 300-800ms
function randomDebounce(): number {
  return 300 + Math.random() * 500;
}

// Wait for price elements to appear (max 3 seconds)
async function waitForPriceElements(maxWaitMs: number = 3000): Promise<void> {
  const priceSelectors = [
    // 최신 쿠팡 셀렉터
    ".final-price-amount",
    ".sales-price-amount",
    ".price-amount",
    // 기존 셀렉터
    ".prod-sale-price",
    ".total-price",
    "[class*='sale-price']",
    ".prod-price",
    "[class*='price']",
  ];

  const startTime = Date.now();
  const checkInterval = 200;

  while (Date.now() - startTime < maxWaitMs) {
    for (const selector of priceSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent?.match(/[\d,]+/)) {
        // Found a price element with numeric content
        return;
      }
    }
    await sleep(checkInterval);
  }
}

async function scrape(
  cursor: number,
  perRun: number
): Promise<{ results: ScrapeResult[]; nextCursor: number; pageStatusCode: string; productName: string | null }> {
  // Extract product name once per page
  const productName = extractProductName(document);
  const results: ScrapeResult[] = [];

  // Wait for price elements to be rendered
  await waitForPriceElements();

  // Detect option groups
  const optionGroups = detectOptionGroups(document);

  if (optionGroups.length === 0) {
    // No options — extract single price
    const priceResult = extractPriceFromDOM(document);
    results.push({
      option_key: "default",
      price: priceResult.price,
      status_code: priceResult.statusCode,
      raw_price_text: priceResult.rawPriceText || undefined,
      product_name: productName || undefined,
    });

    return {
      results,
      nextCursor: 0,
      pageStatusCode: priceResult.statusCode,
      productName,
    };
  }

  // Generate combinations and get subset for this run
  const allCombinations = generateOptionCombinations(optionGroups);
  const { variants, nextCursor } = getVariantsForRun(allCombinations, cursor, perRun);

  for (const optionLabels of variants) {
    // Click option buttons
    await selectOptions(optionLabels, optionGroups);
    await sleep(randomDebounce());

    // Extract price
    const priceResult = extractPriceFromDOM(document);
    const optionKey = buildOptionKey(optionLabels);

    results.push({
      option_key: optionKey,
      price: priceResult.price,
      status_code: priceResult.statusCode,
      raw_price_text: priceResult.rawPriceText || undefined,
      // Include product name on first result only
      ...(results.length === 0 ? { product_name: productName || undefined } : {}),
    });
  }

  const pageStatusCode = results.every((r) => r.status_code === "OK")
    ? "OK"
    : results.some((r) => r.status_code === "SOLD_OUT")
      ? "SOLD_OUT"
      : "FAIL_SELECTOR";

  return { results, nextCursor, pageStatusCode, productName };
}

async function selectOptions(
  labels: string[],
  groups: { name: string; options: string[] }[]
): Promise<void> {
  for (let i = 0; i < labels.length && i < groups.length; i++) {
    const targetLabel = labels[i];

    // Find and click the matching option button
    const buttons = document.querySelectorAll(
      "button, li[role='option'], [class*='option-item'], [class*='chip']"
    );

    for (const btn of buttons) {
      if (btn.textContent?.trim() === targetLabel) {
        (btn as HTMLElement).click();
        break;
      }
    }
  }
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message: ScrapeMessage, _sender, _sendResponse) => {
  if (message.type !== "START_SCRAPE") return false;

  // Execute async scraping without blocking the message channel
  (async () => {
    try {
      const { results, nextCursor, pageStatusCode, productName } = await scrape(
        message.variantCursor,
        message.variantsPerRun
      );
      chrome.runtime.sendMessage({
        type: "SCRAPE_RESULT",
        results,
        variantCursor: nextCursor,
        pageStatusCode,
        productName,
      });
    } catch (err) {
      console.error("[PriceWatch] Scrape error:", err);
      chrome.runtime.sendMessage({
        type: "SCRAPE_RESULT",
        results: [
          {
            option_key: "default",
            price: null,
            status_code: "FAIL_SELECTOR",
          },
        ],
        variantCursor: message.variantCursor,
        pageStatusCode: "FAIL_SELECTOR",
      });
    }
  })();

  // Don't return true - we're using sendMessage, not sendResponse
  return false;
});

