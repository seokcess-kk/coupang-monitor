const DEFAULT_CONFIG = {
  apiBaseUrl: "http://localhost:3000",
  apiKey: "dev_key_change_me"
};

const getConfig = async () => {
  const stored = await chrome.storage.local.get(["apiBaseUrl", "apiKey"]);
  return {
    apiBaseUrl: stored.apiBaseUrl ?? DEFAULT_CONFIG.apiBaseUrl,
    apiKey: stored.apiKey ?? DEFAULT_CONFIG.apiKey
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = (promise, timeoutMs) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeoutMs)
    )
  ]);

const pullJob = async () => {
  const { apiBaseUrl, apiKey } = await getConfig();
  const response = await fetch(`${apiBaseUrl}/api/jobs/next`, {
    headers: {
      "X-API-KEY": apiKey
    }
  });
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data.job;
};

const runScrape = async (job) => {
  const tab = await chrome.tabs.create({ url: job.url, active: false });
  const tabId = tab.id;
  if (!tabId) {
    return { page_status_code: "FAIL_SELECTOR", results: [] };
  }

  await new Promise((resolve) => {
    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/content.js"]
  });

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (payload) => {
      if (typeof window.__pricewatchScrape !== "function") {
        return { page_status_code: "FAIL_SELECTOR", results: [] };
      }
      return window.__pricewatchScrape(payload);
    },
    args: [
      {
        variantLimit: job.variant_limit,
        variantCursor: job.variant_cursor,
        pageTimeoutMs: job.page_timeout_ms
      }
    ]
  });

  await chrome.tabs.remove(tabId);
  return result.result ?? { page_status_code: "FAIL_SELECTOR", results: [] };
};

const uploadSnapshots = async (job, payload) => {
  const { apiBaseUrl } = await getConfig();
  await fetch(`${apiBaseUrl}/api/snapshots/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      job_id: job.id,
      item_id: job.item_id,
      url: job.url,
      results: payload.results,
      page_status_code: payload.page_status_code,
      checked_at: payload.checked_at,
      next_cursor: payload.next_cursor
    })
  });
};

const processNextJob = async () => {
  const job = await pullJob();
  if (!job) return;
  try {
    const payload = await withTimeout(
      runScrape(job),
      job.page_timeout_ms ?? 20000
    );
    const safePayload =
      payload.results && payload.results.length > 0
        ? payload
        : {
            ...payload,
            results: [
              {
                option_key: "default",
                price: null,
                status_code:
                  payload.page_status_code === "BLOCK_SUSPECT"
                    ? "BLOCK_SUSPECT"
                    : "FAIL_SELECTOR"
              }
            ]
          };
    await uploadSnapshots(job, safePayload);
  } catch (error) {
    await uploadSnapshots(job, {
      results: [
        {
          option_key: "default",
          price: null,
          status_code: error?.message === "timeout" ? "TIMEOUT" : "FAIL_SELECTOR"
        }
      ],
      page_status_code: error?.message === "timeout" ? "TIMEOUT" : "FAIL_SELECTOR",
      checked_at: new Date().toISOString(),
      next_cursor: job.variant_cursor
    });
  } finally {
    await sleep(1000);
  }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("pricewatch-poll", { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pricewatch-poll") {
    void processNextJob();
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("pricewatch-poll", { periodInMinutes: 1 });
});
