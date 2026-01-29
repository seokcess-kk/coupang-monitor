interface JobResponse {
  jobId: string;
  itemId: string;
  url: string;
  name: string | null;
  variantCursor: number;
  variantsPerRun: number;
  pageTimeoutMs: number;
}

interface ScrapeResult {
  option_key: string;
  price: number | null;
  status_code: string;
  raw_price_text?: string;
  product_name?: string;
}

interface ScrapingResponse {
  results: ScrapeResult[];
  productName: string | null;
  pageStatusCode: string;
}

interface ContentScriptResponse {
  results: ScrapeResult[];
  variantCursor: number;
  pageStatusCode: string;
  productName?: string | null;
}

let isPolling = false;
let apiBaseUrl = "";
let apiKey = "";

const POLL_INTERVAL_MS = 5000;

async function getConfig(): Promise<{ apiBaseUrl: string; apiKey: string }> {
  const data = await chrome.storage.local.get(["apiBaseUrl", "apiKey"]);
  return {
    apiBaseUrl: data.apiBaseUrl || "http://localhost:3000",
    apiKey: data.apiKey || "",
  };
}

async function fetchNextJob(): Promise<JobResponse | null> {
  const config = await getConfig();
  apiBaseUrl = config.apiBaseUrl;
  apiKey = config.apiKey;

  if (!apiKey) return null;

  try {
    const res = await fetch(`${apiBaseUrl}/api/jobs/next`, {
      headers: { "X-API-KEY": apiKey },
    });

    if (res.status === 204) return null;
    if (!res.ok) return null;

    return await res.json();
  } catch (err) {
    console.error("[PriceWatch] Failed to fetch job:", err);
    return null;
  }
}

async function uploadResults(
  job: JobResponse,
  response: ContentScriptResponse
): Promise<void> {
  try {
    await fetch(`${apiBaseUrl}/api/snapshots/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        job_id: job.jobId,
        item_id: job.itemId,
        url: job.url,
        results: response.results,
        page_status_code: response.pageStatusCode,
        checked_at: new Date().toISOString(),
        variant_cursor: response.variantCursor,
        product_name: response.productName,
      }),
    });
  } catch (err) {
    console.error("[PriceWatch] Failed to upload results:", err);
  }
}

// Inline scraping function - this runs in the page context
function scrapePageContent(): ScrapingResponse {
  // Extract product name
  let productName: string | null = null;
  const nameSelectors = [
    ".prod-buy-header h1",
    ".prod-buy-header__title",
    "h1.prod-title",
    "[class*='product-title']",
    "h1[class*='title']",
    ".product-name h1",
    "h1",
  ];

  for (const selector of nameSelectors) {
    const el = document.querySelector(selector);
    if (el?.textContent?.trim()) {
      productName = el.textContent.trim();
      break;
    }
  }

  // Fallback to document title
  if (!productName && document.title) {
    const titleParts = document.title.split(" - ");
    productName = titleParts[0]?.trim() || null;
  }

  // Check for sold out
  const soldOutSelectors = [
    ".oos-label",
    ".out-of-stock",
    "[class*='sold-out']",
    "[class*='soldout']",
    ".prod-not-available",
  ];

  for (const selector of soldOutSelectors) {
    if (document.querySelector(selector)) {
      return {
        results: [{
          option_key: "default",
          price: null,
          status_code: "SOLD_OUT",
          product_name: productName || undefined,
        }],
        productName,
        pageStatusCode: "SOLD_OUT",
      };
    }
  }

  // Check purchase button text
  const buyBtn = document.querySelector(".prod-buy-btn, [class*='buy-btn']");
  if (buyBtn?.textContent) {
    const btnText = buyBtn.textContent;
    if (btnText.includes("품절") || btnText.includes("일시품절") || btnText.includes("재입고")) {
      return {
        results: [{
          option_key: "default",
          price: null,
          status_code: "SOLD_OUT",
          product_name: productName || undefined,
        }],
        productName,
        pageStatusCode: "SOLD_OUT",
      };
    }
  }

  // Parse KRW price from text - requires "원" suffix
  function parseKrwPrice(text: string): number | null {
    // Must contain "원" to be a valid price
    if (!text.includes("원")) return null;

    // Extract number before "원"
    const match = text.match(/([\d,]+)\s*원/);
    if (!match) return null;

    const numStr = match[1].replace(/,/g, "");
    const parsed = parseInt(numStr, 10);

    return isNaN(parsed) || parsed <= 0 ? null : parsed;
  }

  // Try to extract price from specific selectors first
  // Priority: final-price (와우할인가) > sales-price (쿠팡판매가) > original-price
  const priceSelectors = [
    // New Coupang selectors (from actual page HTML)
    ".final-price-amount",
    ".sales-price-amount",
    ".price-amount.final-price-amount",
    ".price-amount.sales-price-amount",
    ".final-price .price-amount",
    ".sales-price .price-amount",
    ".price-container .final-price-amount",
    ".price-container .sales-price-amount",
    // Legacy selectors
    ".prod-sale-price .total-price strong",
    ".prod-sale-price strong",
    ".total-price strong",
    "[class*='sale-price'] strong",
    ".prod-price strong",
    "[class*='final-price'] strong",
    ".prod-coupon-price .total-price strong",
    ".prod-origin-price strong",
    "[class*='price-value']",
    ".prod-pdd-price strong",
  ];

  for (const selector of priceSelectors) {
    const el = document.querySelector(selector);
    if (el?.textContent) {
      const price = parseKrwPrice(el.textContent);
      if (price !== null) {
        return {
          results: [{
            option_key: "default",
            price,
            status_code: "OK",
            raw_price_text: el.textContent,
            product_name: productName || undefined,
          }],
          productName,
          pageStatusCode: "OK",
        };
      }
    }
  }

  // Fallback: search within price-related containers only
  const priceContainers = document.querySelectorAll("[class*='price'], .prod-buy-header");
  for (const container of priceContainers) {
    const strongElements = container.querySelectorAll("strong");
    for (const el of strongElements) {
      const text = el.textContent || "";
      const price = parseKrwPrice(text);
      if (price !== null) {
        return {
          results: [{
            option_key: "default",
            price,
            status_code: "OK",
            raw_price_text: text,
            product_name: productName || undefined,
          }],
          productName,
          pageStatusCode: "OK",
        };
      }
    }
  }

  // Failed to extract
  return {
    results: [{
      option_key: "default",
      price: null,
      status_code: "FAIL_SELECTOR",
      product_name: productName || undefined,
    }],
    productName,
    pageStatusCode: "FAIL_SELECTOR",
  };
}

async function processJob(job: JobResponse): Promise<void> {
  return new Promise((resolve) => {
    // Open tab
    chrome.tabs.create({ url: job.url, active: false }, (tab) => {
      if (!tab.id) {
        resolve();
        return;
      }

      const tabId = tab.id;
      let timeoutId: ReturnType<typeof setTimeout>;

      // Set up timeout
      timeoutId = setTimeout(async () => {
        await uploadResults(job, {
          results: [{
            option_key: "default",
            price: null,
            status_code: "TIMEOUT",
          }],
          variantCursor: job.variantCursor,
          pageStatusCode: "TIMEOUT",
        });
        chrome.tabs.remove(tabId).catch(() => { });
        resolve();
      }, job.pageTimeoutMs);

      // Wait for page to load, then execute inline script
      chrome.tabs.onUpdated.addListener(function onUpdated(
        updatedTabId,
        changeInfo
      ) {
        if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
        chrome.tabs.onUpdated.removeListener(onUpdated);

        // Wait a bit for dynamic content to load
        setTimeout(async () => {
          try {
            // Execute inline scraping function
            const results = await chrome.scripting.executeScript({
              target: { tabId },
              func: scrapePageContent,
            });

            clearTimeout(timeoutId);

            if (results && results[0]?.result) {
              const scrapeData = results[0].result as ScrapingResponse;
              await uploadResults(job, {
                results: scrapeData.results,
                variantCursor: 0,
                pageStatusCode: scrapeData.pageStatusCode,
                productName: scrapeData.productName,
              });
            } else {
              // No result
              await uploadResults(job, {
                results: [{
                  option_key: "default",
                  price: null,
                  status_code: "FAIL_SELECTOR",
                }],
                variantCursor: job.variantCursor,
                pageStatusCode: "FAIL_SELECTOR",
              });
            }
          } catch (err) {
            console.error("[PriceWatch] Script execution failed:", err);
            clearTimeout(timeoutId);
            await uploadResults(job, {
              results: [{
                option_key: "default",
                price: null,
                status_code: "FAIL_SELECTOR",
              }],
              variantCursor: job.variantCursor,
              pageStatusCode: "FAIL_SELECTOR",
            });
          }

          chrome.tabs.remove(tabId).catch(() => { });
          resolve();
        }, 2000); // Wait 2 seconds for page content to load
      });
    });
  });
}

async function pollLoop(): Promise<void> {
  while (isPolling) {
    const job = await fetchNextJob();

    if (job) {
      await chrome.action.setBadgeText({ text: "..." });
      await processJob(job);
      await chrome.action.setBadgeText({ text: "" });
    } else {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
}

// Message handlers from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "START_POLLING") {
    if (!isPolling) {
      isPolling = true;
      pollLoop();
    }
    sendResponse({ polling: true });
  } else if (message.type === "STOP_POLLING") {
    isPolling = false;
    sendResponse({ polling: false });
  } else if (message.type === "GET_STATUS") {
    sendResponse({ polling: isPolling });
  }
  return true;
});

// Keep service worker alive with alarm
chrome.alarms.create("keepAlive", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive" && isPolling) {
    // Wake up and continue polling
  }
});
