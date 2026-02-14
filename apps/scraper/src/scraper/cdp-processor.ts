/**
 * CDP-based Job Processor
 * Uses Chrome DevTools Protocol to connect to existing browser
 */

import type { Page } from 'puppeteer';
import {
  connectToBrowser,
  disconnectBrowser,
  isChomeAvailable,
  getChromeInfo,
} from './cdp-browser.js';
import { PageScraper } from './page-scraper.js';
import { ApiClient } from '../api/client.js';
import { config } from '../config.js';
import type { ItemInfo, JobResult } from '../core/types.js';

export interface RunOptions {
  mode: 'all' | 'selected';
  itemIds?: string[];
  onProgress?: (completed: number, failed: number, total: number) => void;
}

export class CDPScraperService {
  private apiClient: ApiClient;
  private pageScraper: PageScraper;
  private isRunning = false;
  private shouldStop = false;
  private activePage: Page | null = null;

  constructor() {
    this.apiClient = new ApiClient();
    this.pageScraper = new PageScraper();
  }

  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Run scraping job using CDP connection
   */
  async run(options: RunOptions): Promise<JobResult> {
    if (this.isRunning) {
      throw new Error('Scraper is already running');
    }

    // Check if Chrome is available
    const chromeAvailable = await isChomeAvailable();
    if (!chromeAvailable) {
      console.error('');
      console.error('❌ Chrome is not running in debug mode!');
      console.error('');
      console.error('Please run: scripts/start-chrome-debug.bat');
      console.error('');
      throw new Error('Chrome not available. Run start-chrome-debug.bat first.');
    }

    // Show Chrome info
    const chromeInfo = await getChromeInfo();
    if (chromeInfo) {
      console.log(`🌐 Chrome: ${chromeInfo.browser}`);
    }

    this.isRunning = true;
    this.shouldStop = false;

    const startTime = Date.now();
    let completed = 0;
    let failed = 0;

    try {
      // 1. Check API health
      const isHealthy = await this.apiClient.healthCheck();
      if (!isHealthy) {
        console.warn('⚠️ API server is not available, continuing anyway...');
      }

      // 2. Get items to scrape
      let items: ItemInfo[];
      if (options.mode === 'selected' && options.itemIds?.length) {
        items = await this.apiClient.getItemsByIds(options.itemIds);
      } else {
        items = await this.apiClient.getItems();
      }

      console.log(`\n📋 Found ${items.length} items to scrape`);

      if (items.length === 0) {
        return { success: 0, failed: 0, total: 0, durationMs: 0 };
      }

      // 3. Connect to browser
      const browser = await connectToBrowser();

      // 4. Process items with concurrency
      const concurrency = Math.min(config.concurrency, items.length);
      const pages: Page[] = [];

      // Create pages
      for (let i = 0; i < concurrency; i++) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        pages.push(page);
      }

      console.log(`🚀 Using ${concurrency} concurrent tabs`);

      // Process queue
      let itemIndex = 0;

      async function processWithPage(page: Page, self: CDPScraperService): Promise<void> {
        while (itemIndex < items.length && !self.shouldStop) {
          const index = itemIndex++;
          const item = items[index];

          try {
            // Random delay for rate limiting
            const delay = config.minDelay + Math.random() * (config.maxDelay - config.minDelay);
            await new Promise(resolve => setTimeout(resolve, delay));

            // Scrape the page
            const result = await self.pageScraper.scrape(page, item.url, {
              variantCursor: item.variantCursor,
              variantsPerRun: config.variantsPerRun,
              pageTimeoutMs: config.pageTimeoutMs,
            });

            // Upload results
            await self.apiClient.uploadSnapshots(
              item.id,
              item.url,
              result.results,
              result.nextCursor,
              result.pageStatusCode,
              result.productName
            );

            completed++;
            console.log(`✅ [${completed}/${items.length}] ${item.name || 'Unknown'}`);
          } catch (error) {
            failed++;
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ [${completed + failed}/${items.length}] ${item.name}: ${message}`);
          }

          options.onProgress?.(completed, failed, items.length);
        }
      }

      // Start processing with all pages
      await Promise.all(pages.map(page => processWithPage(page, this)));

      // Close pages (but not browser)
      for (const page of pages) {
        try {
          if (!page.isClosed()) {
            await page.close();
          }
        } catch {
          // Ignore close errors
        }
      }

      return {
        success: completed,
        failed,
        total: items.length,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.isRunning = false;
      // Disconnect but don't close the browser
      await disconnectBrowser();
    }
  }

  /**
   * Stop the current scraping job
   */
  async stop(): Promise<void> {
    this.shouldStop = true;
    if (this.activePage && !this.activePage.isClosed()) {
      await this.activePage.close().catch(() => {});
    }
    this.isRunning = false;
  }
}

// Singleton
let cdpScraperInstance: CDPScraperService | null = null;

export function getCDPScraperService(): CDPScraperService {
  if (!cdpScraperInstance) {
    cdpScraperInstance = new CDPScraperService();
  }
  return cdpScraperInstance;
}
