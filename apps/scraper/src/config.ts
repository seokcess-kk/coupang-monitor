/**
 * Scraper configuration
 */

import dotenv from 'dotenv';
dotenv.config();

export interface ScheduleConfig {
  name: string;
  cron: string;
  mode?: 'all' | 'selected';
  itemIds?: string[];
}

function parseSchedules(envValue: string | undefined): ScheduleConfig[] {
  if (!envValue) {
    return [
      { name: '오전 수집', cron: '0 7 * * *' },
      { name: '저녁 수집', cron: '0 19 * * *' },
    ];
  }

  try {
    return JSON.parse(envValue);
  } catch {
    console.warn('Failed to parse SCRAPER_SCHEDULES, using defaults');
    return [
      { name: '오전 수집', cron: '0 7 * * *' },
      { name: '저녁 수집', cron: '0 19 * * *' },
    ];
  }
}

export const config = {
  // API connection
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.EXTENSION_API_KEY || '',

  // Puppeteer settings
  concurrency: parseInt(process.env.SCRAPER_CONCURRENCY || '3', 10),
  headless: process.env.SCRAPER_HEADLESS !== 'false',
  pageTimeoutMs: parseInt(process.env.PAGE_TIMEOUT_MS || '20000', 10),
  variantsPerRun: parseInt(process.env.DEFAULT_VARIANT_PER_RUN || '15', 10),

  // Delay settings (for rate limiting)
  minDelay: parseInt(process.env.SCRAPER_MIN_DELAY || '2000', 10),
  maxDelay: parseInt(process.env.SCRAPER_MAX_DELAY || '5000', 10),

  // Retry settings
  maxRetries: parseInt(process.env.SCRAPER_MAX_RETRIES || '2', 10),

  // Server settings
  serverPort: parseInt(process.env.SCRAPER_PORT || '3001', 10),

  // Schedule settings
  schedules: parseSchedules(process.env.SCRAPER_SCHEDULES),
} as const;

export type Config = typeof config;
