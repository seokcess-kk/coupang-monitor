/**
 * Scraper adapter interface
 * Defines site-specific CSS selectors and patterns
 */

export interface ScraperAdapter {
  /** Adapter name (e.g., 'coupang', 'gmarket') */
  name: string;

  /** Price extraction selectors (in priority order) */
  priceSelectors: string[];

  /** Option detection configuration */
  optionDetection: {
    containerSelector: string;
    groupTitleSelector: string;
    itemSelector: string;
  };

  /** Product name selectors (in priority order) */
  nameSelectors: string[];

  /** Sold out detection */
  soldOutIndicators: {
    textPatterns: string[];
    selectors: string[];
  };

  /** Selector to wait for page load completion */
  loadCompleteSelector: string;

  /** Block/captcha detection selectors */
  blockIndicators?: {
    selectors: string[];
    textPatterns: string[];
  };
}
