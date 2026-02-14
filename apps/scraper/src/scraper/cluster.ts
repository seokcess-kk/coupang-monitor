/**
 * Puppeteer Cluster management
 */

import { Cluster } from 'puppeteer-cluster';
import type { Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from '../config.js';

// Apply stealth plugin
puppeteer.use(StealthPlugin());

export type TaskData = {
  url: string;
  itemId: string;
  variantCursor: number;
};

export type TaskResult = {
  itemId: string;
  success: boolean;
  error?: string;
};

let clusterInstance: Cluster<TaskData, TaskResult> | null = null;

/**
 * Create or get existing puppeteer-cluster instance
 */
export async function getCluster(): Promise<Cluster<TaskData, TaskResult>> {
  if (clusterInstance) {
    return clusterInstance;
  }

  console.log(`🚀 Creating browser cluster (concurrency: ${config.concurrency})`);

  clusterInstance = await Cluster.launch({
    // Use puppeteer-extra with stealth plugin
    puppeteer: puppeteer as unknown as typeof import('puppeteer'),
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: config.concurrency,
    puppeteerOptions: {
      headless: config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
        '--lang=ko-KR',
      ],
      defaultViewport: { width: 1920, height: 1080 },
    },
    timeout: config.pageTimeoutMs + 10000, // Add buffer for cluster timeout
    retryLimit: config.maxRetries,
    retryDelay: 1000,
    monitor: false,
  });

  // Error handling
  clusterInstance.on('taskerror', (err, data) => {
    console.error(`❌ Task error for item ${data.itemId}:`, err.message);
  });

  return clusterInstance;
}

/**
 * Close the cluster
 */
export async function closeCluster(): Promise<void> {
  if (clusterInstance) {
    await clusterInstance.idle();
    await clusterInstance.close();
    clusterInstance = null;
    console.log('🛑 Browser cluster closed');
  }
}

/**
 * Get random delay between min and max
 */
export function getRandomDelay(): number {
  return Math.floor(Math.random() * (config.maxDelay - config.minDelay) + config.minDelay);
}

/**
 * Wait for random delay (rate limiting)
 */
export async function randomDelay(): Promise<void> {
  const delay = getRandomDelay();
  await new Promise((resolve) => setTimeout(resolve, delay));
}
