/**
 * CDP (Chrome DevTools Protocol) Browser Connection
 * Connects to an existing Chrome instance for scraping
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { config } from '../config.js';

const CDP_ENDPOINT = process.env.CDP_ENDPOINT || 'http://localhost:9222';

let browserInstance: Browser | null = null;

/**
 * Connect to existing Chrome browser via CDP
 */
export async function connectToBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  console.log(`🔗 Connecting to Chrome at ${CDP_ENDPOINT}...`);

  try {
    // Try to connect to existing Chrome
    browserInstance = await puppeteer.connect({
      browserURL: CDP_ENDPOINT,
      defaultViewport: { width: 1920, height: 1080 },
    });

    console.log('✅ Connected to Chrome successfully');
    return browserInstance;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('ECONNREFUSED')) {
      console.error('❌ Chrome is not running in debug mode');
      console.error('');
      console.error('Please start Chrome with debug mode:');
      console.error('  Windows: Run scripts/start-chrome-debug.bat');
      console.error('  Mac/Linux: Run scripts/start-chrome-debug.sh');
      console.error('');
      console.error('Or start Chrome manually with:');
      console.error('  chrome --remote-debugging-port=9222');
    } else {
      console.error(`❌ Failed to connect to Chrome: ${message}`);
    }

    throw error;
  }
}

/**
 * Create a new page in the connected browser
 */
export async function createPage(): Promise<Page> {
  const browser = await connectToBrowser();
  const page = await browser.newPage();

  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Set user agent (use Chrome's default)
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  );

  return page;
}

/**
 * Close a page
 */
export async function closePage(page: Page): Promise<void> {
  try {
    if (!page.isClosed()) {
      await page.close();
    }
  } catch {
    // Ignore errors when closing
  }
}

/**
 * Disconnect from browser (don't close it)
 */
export async function disconnectBrowser(): Promise<void> {
  if (browserInstance) {
    browserInstance.disconnect();
    browserInstance = null;
    console.log('🔌 Disconnected from Chrome');
  }
}

/**
 * Check if Chrome is available
 */
export async function isChomeAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${CDP_ENDPOINT}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get Chrome version info
 */
export async function getChromeInfo(): Promise<{ browser: string; version: string } | null> {
  try {
    const response = await fetch(`${CDP_ENDPOINT}/json/version`);
    if (response.ok) {
      const data = await response.json();
      return {
        browser: data.Browser || 'Unknown',
        version: data['Protocol-Version'] || 'Unknown',
      };
    }
  } catch {
    // Chrome not available
  }
  return null;
}

/**
 * Process items with CDP-connected browser
 * Similar to cluster but using single browser connection
 */
export async function processWithCDP<T>(
  items: T[],
  processor: (page: Page, item: T, index: number) => Promise<void>,
  options: { concurrency?: number; delayMs?: number } = {}
): Promise<void> {
  const { concurrency = config.concurrency, delayMs = config.minDelay } = options;

  const browser = await connectToBrowser();
  const pages: Page[] = [];

  // Create pages for concurrency
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    pages.push(await browser.newPage());
  }

  console.log(`🚀 Processing ${items.length} items with ${pages.length} concurrent pages`);

  let currentIndex = 0;
  const results: Promise<void>[] = [];

  async function processNext(page: Page): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];

      try {
        await processor(page, item, index);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error processing item ${index}: ${message}`);
      }

      // Delay between requests
      if (currentIndex < items.length) {
        const delay = delayMs + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Start processing with all pages
  for (const page of pages) {
    results.push(processNext(page));
  }

  // Wait for all to complete
  await Promise.all(results);

  // Close all pages
  for (const page of pages) {
    await closePage(page);
  }

  console.log('✅ All items processed');
}
