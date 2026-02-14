/**
 * API client for communicating with the main web server
 */

import { config } from '../config.js';
import type { ScrapeResult, ItemInfo } from '../core/types.js';

export class ApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || config.apiBaseUrl;
    this.apiKey = apiKey || config.apiKey;
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-KEY': this.apiKey,
    };
  }

  /**
   * Get all items to scrape
   */
  async getItems(): Promise<ItemInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/items`, {
      headers: this.headers,
    });

    if (!res.ok) {
      throw new Error(`Failed to get items: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    return data.map((item: Record<string, unknown>) => ({
      id: item.id as string,
      url: item.url as string,
      name: (item.name as string) || null,
      variantCursor: (item.variantCursor as number) || 0,
    }));
  }

  /**
   * Get items by IDs
   */
  async getItemsByIds(itemIds: string[]): Promise<ItemInfo[]> {
    const allItems = await this.getItems();
    return allItems.filter((item) => itemIds.includes(item.id));
  }

  /**
   * Upload scraping results
   * Uses the existing /api/snapshots/batch endpoint
   */
  async uploadSnapshots(
    itemId: string,
    url: string,
    results: ScrapeResult[],
    nextCursor: number,
    pageStatusCode: string,
    productName?: string | null
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/snapshots/batch`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        item_id: itemId,
        url,
        results: results.map((r) => ({
          option_key: r.option_key,
          price: r.price,
          status_code: r.status_code,
          raw_price_text: r.raw_price_text,
        })),
        page_status_code: pageStatusCode,
        checked_at: new Date().toISOString(),
        variant_cursor: nextCursor,
        product_name: productName,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(
        `Failed to upload snapshots: ${res.status} ${res.statusText} - ${errorText}`
      );
    }
  }

  /**
   * Check if the API is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
