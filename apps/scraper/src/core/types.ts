/**
 * Core types for the scraper service
 * Based on apps/extension/src/types.ts
 */

export type StatusCode = 'OK' | 'SOLD_OUT' | 'FAIL_SELECTOR' | 'TIMEOUT' | 'BLOCKED';

export interface ScrapeResult {
  option_key: string;
  price: number | null;
  status_code: StatusCode;
  raw_price_text?: string;
}

export interface OptionGroup {
  name: string;
  options: string[];
}

export interface ScrapingOptions {
  variantCursor: number;
  variantsPerRun: number;
  pageTimeoutMs: number;
}

export interface ScrapingResult {
  results: ScrapeResult[];
  nextCursor: number;
  pageStatusCode: string;
  productName: string | null;
}

export interface PriceResult {
  price: number | null;
  statusCode: StatusCode;
  rawPriceText: string;
}

export interface ItemInfo {
  id: string;
  url: string;
  name: string | null;
  variantCursor: number;
}

export interface JobProgress {
  total: number;
  completed: number;
  failed: number;
}

export interface JobResult {
  success: number;
  failed: number;
  total: number;
  durationMs: number;
}
