/**
 * Job processing logic
 * Orchestrates scraping tasks and API communication
 */

import type { Page } from 'puppeteer';
import { getCluster, closeCluster, randomDelay, type TaskData } from './cluster.js';
import { PageScraper } from './page-scraper.js';
import { ApiClient } from '../api/client.js';
import { config } from '../config.js';
import type { ItemInfo, JobProgress, JobResult } from '../core/types.js';

export interface RunOptions {
  mode: 'all' | 'selected';
  itemIds?: string[];
  group?: string;
  onProgress?: (completed: number, failed: number, total: number) => void;
}

export class ScraperService {
  private apiClient: ApiClient;
  private pageScraper: PageScraper;
  private isRunning = false;
  private shouldStop = false;

  constructor(options?: { concurrency?: number }) {
    this.apiClient = new ApiClient();
    this.pageScraper = new PageScraper();
  }

  /**
   * Check if scraper is currently running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Run scraping job
   */
  async run(options: RunOptions): Promise<JobResult> {
    if (this.isRunning) {
      throw new Error('Scraper is already running');
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
        return {
          success: 0,
          failed: 0,
          total: 0,
          durationMs: Date.now() - startTime,
        };
      }

      // 3. Get cluster
      const cluster = await getCluster();

      // 4. Define task handler
      cluster.task(async ({ page, data }: { page: Page; data: TaskData }) => {
        if (this.shouldStop) {
          throw new Error('Scraping stopped by user');
        }

        const item = items.find((i) => i.id === data.itemId);
        if (!item) {
          throw new Error(`Item not found: ${data.itemId}`);
        }

        // Rate limiting
        await randomDelay();

        // Scrape the page
        const result = await this.pageScraper.scrape(page, data.url, {
          variantCursor: data.variantCursor,
          variantsPerRun: config.variantsPerRun,
          pageTimeoutMs: config.pageTimeoutMs,
        });

        // Upload results
        await this.apiClient.uploadSnapshots(
          item.id,
          item.url,
          result.results,
          result.nextCursor,
          result.pageStatusCode,
          result.productName
        );

        return {
          itemId: item.id,
          success: true,
        };
      });

      // 5. Queue all items
      const promises: Promise<void>[] = [];

      for (const item of items) {
        if (this.shouldStop) break;

        const promise = cluster.queue({
          url: item.url,
          itemId: item.id,
          variantCursor: item.variantCursor,
        }).then(() => {
          completed++;
          options.onProgress?.(completed, failed, items.length);
          console.log(`✅ [${completed}/${items.length}] ${item.name || item.url}`);
        }).catch((error) => {
          failed++;
          options.onProgress?.(completed, failed, items.length);
          console.error(`❌ [${completed + failed}/${items.length}] ${item.name || item.url}: ${error.message}`);
        });

        promises.push(promise);
      }

      // 6. Wait for all tasks to complete
      await Promise.all(promises);
      await cluster.idle();

      return {
        success: completed,
        failed,
        total: items.length,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.isRunning = false;
      await closeCluster();
    }
  }

  /**
   * Stop the current scraping job
   */
  async stop(): Promise<void> {
    this.shouldStop = true;
    await closeCluster();
    this.isRunning = false;
  }
}

// Export singleton for convenience
let scraperInstance: ScraperService | null = null;

export function getScraperService(): ScraperService {
  if (!scraperInstance) {
    scraperInstance = new ScraperService();
  }
  return scraperInstance;
}
