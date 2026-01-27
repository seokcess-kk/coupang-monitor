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
}

interface ContentScriptResponse {
  results: ScrapeResult[];
  variantCursor: number;
  pageStatusCode: string;
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
      }),
    });
  } catch (err) {
    console.error("[PriceWatch] Failed to upload results:", err);
  }
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
        // Timeout - report and close
        await uploadResults(job, {
          results: [
            {
              option_key: "default",
              price: null,
              status_code: "TIMEOUT",
            },
          ],
          variantCursor: job.variantCursor,
          pageStatusCode: "TIMEOUT",
        });
        chrome.tabs.remove(tabId).catch(() => {});
        resolve();
      }, job.pageTimeoutMs);

      // Listen for content script messages
      const listener = (
        message: ContentScriptResponse & { type: string },
        sender: chrome.runtime.MessageSender
      ) => {
        if (sender.tab?.id !== tabId) return;
        if (message.type !== "SCRAPE_RESULT") return;

        clearTimeout(timeoutId);
        chrome.runtime.onMessage.removeListener(listener);

        uploadResults(job, message).then(() => {
          chrome.tabs.remove(tabId).catch(() => {});
          resolve();
        });
      };

      chrome.runtime.onMessage.addListener(listener);

      // Inject content script when page loads
      chrome.tabs.onUpdated.addListener(function onUpdated(
        updatedTabId,
        changeInfo
      ) {
        if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
        chrome.tabs.onUpdated.removeListener(onUpdated);

        chrome.tabs.sendMessage(tabId, {
          type: "START_SCRAPE",
          variantCursor: job.variantCursor,
          variantsPerRun: job.variantsPerRun,
        });
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
