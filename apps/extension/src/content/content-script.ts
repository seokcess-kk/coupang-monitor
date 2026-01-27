import { extractPriceFromDOM, type PriceResult } from "./price-extractor";
import { buildOptionKey, detectOptionGroups, generateOptionCombinations, getVariantsForRun } from "./option-iterator";

interface ScrapeMessage {
  type: "START_SCRAPE";
  variantCursor: number;
  variantsPerRun: number;
}

interface ScrapeResult {
  option_key: string;
  price: number | null;
  status_code: string;
  raw_price_text?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Random debounce between 300-800ms
function randomDebounce(): number {
  return 300 + Math.random() * 500;
}

async function scrape(
  cursor: number,
  perRun: number
): Promise<{ results: ScrapeResult[]; nextCursor: number; pageStatusCode: string }> {
  const results: ScrapeResult[] = [];

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
    });

    return {
      results,
      nextCursor: 0,
      pageStatusCode: priceResult.statusCode,
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
    });
  }

  const pageStatusCode = results.every((r) => r.status_code === "OK")
    ? "OK"
    : results.some((r) => r.status_code === "SOLD_OUT")
      ? "SOLD_OUT"
      : "FAIL_SELECTOR";

  return { results, nextCursor, pageStatusCode };
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
chrome.runtime.onMessage.addListener((message: ScrapeMessage, _sender, sendResponse) => {
  if (message.type !== "START_SCRAPE") return;

  scrape(message.variantCursor, message.variantsPerRun)
    .then(({ results, nextCursor, pageStatusCode }) => {
      chrome.runtime.sendMessage({
        type: "SCRAPE_RESULT",
        results,
        variantCursor: nextCursor,
        pageStatusCode,
      });
    })
    .catch((err) => {
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
    });

  return true;
});
