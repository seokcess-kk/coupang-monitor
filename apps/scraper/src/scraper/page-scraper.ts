/**
 * Page scraping logic using Puppeteer
 */

import type { Page } from 'puppeteer';
import type { ScraperAdapter } from '../adapters/adapter.interface.js';
import { coupangAdapter } from '../adapters/coupang.adapter.js';
import { parseKrwPrice, isValidPriceContext } from '../core/price-parser.js';
import {
  buildOptionKey,
  generateOptionCombinations,
  getVariantsForRun,
} from '../core/option-manager.js';
import type {
  ScrapeResult,
  ScrapingOptions,
  ScrapingResult,
  OptionGroup,
  StatusCode,
} from '../core/types.js';
import { config } from '../config.js';
import { randomDelay } from './cluster.js';

export class PageScraper {
  private adapter: ScraperAdapter;

  constructor(adapter: ScraperAdapter = coupangAdapter) {
    this.adapter = adapter;
  }

  /**
   * Scrape a product page
   */
  async scrape(
    page: Page,
    url: string,
    options: ScrapingOptions
  ): Promise<ScrapingResult> {
    console.log(`📄 Scraping: ${url}`);

    try {
      // 1. Navigate to page
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: options.pageTimeoutMs,
      });

      // 2. Wait for content to load
      await this.waitForContent(page);


      // 3. Check for blocking
      const isBlocked = await this.checkBlocked(page);
      if (isBlocked) {
        console.log(`🚫 Blocked detected for: ${url}`);
        return {
          results: [{ option_key: 'default', price: null, status_code: 'BLOCKED' }],
          nextCursor: options.variantCursor,
          pageStatusCode: 'BLOCKED',
          productName: null,
        };
      }

      // 4. Extract product name
      const productName = await this.extractProductName(page);

      // 5. Check for sold out
      const isSoldOut = await this.checkSoldOut(page);
      if (isSoldOut) {
        console.log(`📦 Sold out: ${url}`);
        return {
          results: [{ option_key: 'default', price: null, status_code: 'SOLD_OUT' }],
          nextCursor: 0,
          pageStatusCode: 'SOLD_OUT',
          productName,
        };
      }

      // 6. Detect option groups
      const optionGroups = await this.detectOptionGroups(page);
      console.log(`   Found ${optionGroups.length} option groups`);

      // 7. No options: single price extraction
      if (optionGroups.length === 0) {
        const priceResult = await this.extractPrice(page);
        console.log(`   Price: ${priceResult.price ?? 'N/A'} (${priceResult.statusCode})`);

        return {
          results: [{
            option_key: 'default',
            price: priceResult.price,
            status_code: priceResult.statusCode,
            raw_price_text: priceResult.rawPriceText,
          }],
          nextCursor: 0,
          pageStatusCode: priceResult.statusCode,
          productName,
        };
      }

      // 8. With options: round-robin iteration
      const allCombinations = generateOptionCombinations(optionGroups);
      console.log(`   Total combinations: ${allCombinations.length}`);

      const { variants, nextCursor } = getVariantsForRun(
        allCombinations,
        options.variantCursor,
        options.variantsPerRun
      );
      console.log(`   Processing ${variants.length} variants (cursor: ${options.variantCursor} -> ${nextCursor})`);

      const results: ScrapeResult[] = [];

      for (const labels of variants) {
        // Select options
        await this.selectOptions(page, labels);
        await this.waitForPriceUpdate(page);

        // Extract price
        const priceResult = await this.extractPrice(page);
        const optionKey = buildOptionKey(labels);

        results.push({
          option_key: optionKey,
          price: priceResult.price,
          status_code: priceResult.statusCode,
          raw_price_text: priceResult.rawPriceText,
        });

        console.log(`   ${optionKey}: ${priceResult.price ?? 'N/A'}`);
      }

      const pageStatusCode = this.determinePageStatus(results);

      return {
        results,
        nextCursor,
        pageStatusCode,
        productName,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Scraping error: ${message}`);

      if (message.includes('timeout') || message.includes('Timeout')) {
        return {
          results: [{ option_key: 'default', price: null, status_code: 'TIMEOUT' }],
          nextCursor: options.variantCursor,
          pageStatusCode: 'TIMEOUT',
          productName: null,
        };
      }

      throw error;
    }
  }

  /**
   * Wait for main content to load
   */
  private async waitForContent(page: Page): Promise<void> {
    try {
      await page.waitForSelector(this.adapter.loadCompleteSelector, {
        timeout: 5000,
      });
    } catch {
      // Continue even if selector not found
    }

    // Additional wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Check if page is blocked (captcha, etc.)
   */
  private async checkBlocked(page: Page): Promise<boolean> {
    if (!this.adapter.blockIndicators) return false;

    // Check selectors
    for (const selector of this.adapter.blockIndicators.selectors) {
      const element = await page.$(selector);
      if (element) return true;
    }

    // Check text patterns
    const bodyText = await page.$eval('body', (el) => el.innerText).catch(() => '');
    for (const pattern of this.adapter.blockIndicators.textPatterns) {
      if (bodyText.toLowerCase().includes(pattern.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract product name
   */
  private async extractProductName(page: Page): Promise<string | null> {
    for (const selector of this.adapter.nameSelectors) {
      try {
        const name = await page.$eval(selector, (el) => el.textContent?.trim());
        if (name) return name;
      } catch {
        // Continue to next selector
      }
    }

    // Fallback: extract from title
    try {
      const title = await page.title();
      // Remove common suffixes like " - 쿠팡!"
      return title.replace(/\s*[-|]\s*쿠팡!?\s*$/, '').trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if product is sold out
   */
  private async checkSoldOut(page: Page): Promise<boolean> {
    // Check selectors
    for (const selector of this.adapter.soldOutIndicators.selectors) {
      const element = await page.$(selector);
      if (element) return true;
    }

    // Check text patterns in purchase button
    try {
      const buttonText = await page.$eval(
        '.prod-buy-btn, .buy-button, [class*="purchase"], [class*="buy-btn"]',
        (el) => el.textContent?.toLowerCase() ?? ''
      );

      for (const pattern of this.adapter.soldOutIndicators.textPatterns) {
        if (buttonText.includes(pattern.toLowerCase())) {
          return true;
        }
      }
    } catch {
      // Button not found, continue
    }

    return false;
  }

  /**
   * Detect option groups on the page
   */
  private async detectOptionGroups(page: Page): Promise<OptionGroup[]> {
    const adapter = this.adapter;

    return page.evaluate((adapterConfig) => {
      const groups: { name: string; options: string[] }[] = [];

      // Find option containers
      const containers = document.querySelectorAll(adapterConfig.optionDetection.containerSelector);

      containers.forEach((container, idx) => {
        // Find group title
        const titleEl = container.querySelector(adapterConfig.optionDetection.groupTitleSelector);
        const title = titleEl?.textContent?.trim() || `옵션${idx + 1}`;

        // Find option items
        const items = container.querySelectorAll(adapterConfig.optionDetection.itemSelector);
        const options: string[] = [];

        items.forEach((item) => {
          const text = item.textContent?.trim();
          // Filter out price-like text
          if (text && !text.includes('원') && text.length < 50) {
            options.push(text);
          }
        });

        if (options.length > 1) {
          groups.push({ name: title, options });
        }
      });

      return groups;
    }, adapter);
  }

  /**
   * Extract current price from page using HTML-based extraction (more robust)
   */
  private async extractPrice(page: Page): Promise<{
    price: number | null;
    statusCode: StatusCode;
    rawPriceText: string;
  }> {
    // Get page HTML for regex-based extraction (more reliable than selectors)
    const html = await page.content();

    // Check for sold out in HTML
    if (html.includes('품절') || html.includes('일시품절')) {
      // Verify it's actually sold out (not just mentioned in text)
      const soldOutMatch = /<[^>]*class[^>]*(sold-out|soldout|oos-label|out-of-stock)[^>]*>/i.test(html);
      const buttonSoldOut = await page.evaluate(() => {
        const btn = document.querySelector('.prod-buy-btn, .buy-button, [class*="purchase"]');
        return btn?.textContent?.includes('품절') || btn?.textContent?.includes('일시품절');
      }).catch(() => false);

      if (soldOutMatch || buttonSoldOut) {
        return { price: null, statusCode: 'SOLD_OUT', rawPriceText: '' };
      }
    }

    // Priority A: New Coupang structure - final-price-amount (최종가)
    const finalPriceResult = await this.extractFinalPrice(page);
    if (finalPriceResult) {
      console.log(`   [Price] Found final-price: ${finalPriceResult.price}`);
      return finalPriceResult;
    }

    // Priority B: Look for "쿠팡판매가" label in HTML
    const coupangSalePriceIdx = html.indexOf('쿠팡판매가');
    if (coupangSalePriceIdx !== -1) {
      const afterLabel = html.slice(coupangSalePriceIdx, coupangSalePriceIdx + 200);
      const strongMatch = afterLabel.match(/<strong[^>]*>([\d,]+)<\/strong>/);
      if (strongMatch) {
        const price = parseKrwPrice(strongMatch[1]);
        if (price !== null) {
          console.log(`   [Price] Found 쿠팡판매가: ${price}`);
          return { price, statusCode: 'OK', rawPriceText: strongMatch[1] };
        }
      }
    }

    // Priority C: Extract <strong> tagged prices (prominent/discounted prices)
    const strongPrices = this.extractStrongPrices(html);
    if (strongPrices.length > 0) {
      // Use the last (usually final/discounted) price
      const finalPrice = strongPrices[strongPrices.length - 1];
      console.log(`   [Price] Found strong tag: ${finalPrice.value}`);
      return { price: finalPrice.value, statusCode: 'OK', rawPriceText: finalPrice.text };
    }

    // Priority D: Try CSS selectors as fallback
    for (const selector of this.adapter.priceSelectors) {
      try {
        const text = await page.$eval(selector, (el) => el.textContent?.trim() ?? '');
        if (text && isValidPriceContext(text)) {
          const price = parseKrwPrice(text);
          if (price !== null) {
            console.log(`   [Price] Found via selector ${selector}: ${price}`);
            return { price, statusCode: 'OK', rawPriceText: text };
          }
        }
      } catch {
        // Selector not found, continue
      }
    }

    // Priority E: Find any price pattern in the price section
    const allPrices = this.extractAllPrices(html);
    if (allPrices.length > 0) {
      const finalPrice = allPrices[allPrices.length - 1];
      console.log(`   [Price] Found via pattern: ${finalPrice.value}`);
      return { price: finalPrice.value, statusCode: 'OK', rawPriceText: finalPrice.text };
    }

    return { price: null, statusCode: 'FAIL_SELECTOR', rawPriceText: '' };
  }

  /**
   * Extract final price from new Coupang HTML structure (2024+)
   * Prioritizes .final-price-amount over .original-price-amount
   */
  private async extractFinalPrice(page: Page): Promise<{
    price: number | null;
    statusCode: StatusCode;
    rawPriceText: string;
  } | null> {
    // Try final-price first (this is the actual selling price)
    const finalSelectors = [
      '.final-price-amount',
      '.final-price .price-amount',
      '[class*="final-price-amount"]',
      '.sales-price-amount',
      '.sales-price .price-amount',
    ];

    for (const selector of finalSelectors) {
      try {
        const text = await page.$eval(selector, (el) => el.textContent?.trim() ?? '');
        if (text) {
          const price = parseKrwPrice(text);
          if (price !== null) {
            return { price, statusCode: 'OK', rawPriceText: text };
          }
        }
      } catch {
        // Selector not found, continue
      }
    }

    return null;
  }

  /**
   * Extract prices from <strong> tags (commonly used for sale prices)
   */
  private extractStrongPrices(html: string): { value: number; text: string }[] {
    const results: { value: number; text: string }[] = [];
    const pattern = /<strong[^>]*>([\d,]+)<\/strong>\s*원?/g;
    const unitPriceRe = /\d+[gml]당|\d+ml당|\d+g당/i;
    let match;

    while ((match = pattern.exec(html)) !== null) {
      const contextStart = Math.max(0, match.index - 50);
      const context = html.slice(contextStart, match.index + match[0].length);

      // Skip unit prices and coupon prices
      if (unitPriceRe.test(context)) continue;
      if (context.includes('쿠폰할인') || context.includes('쿠폰적용')) continue;
      if (context.includes('100g당') || context.includes('100ml당')) continue;

      const value = parseKrwPrice(match[1]);
      if (value !== null && value >= 100) { // Filter out too small numbers
        results.push({ value, text: match[1] });
      }
    }

    return results;
  }

  /**
   * Extract all price patterns from HTML
   */
  private extractAllPrices(html: string): { value: number; text: string }[] {
    const results: { value: number; text: string }[] = [];
    const seen = new Set<number>();
    const unitPriceRe = /\d+[gml]당|\d+ml당|\d+g당/i;

    // Look for price patterns in price-related sections
    const priceSection = html.match(/<[^>]*class[^>]*(price|sale|total)[^>]*>[\s\S]*?<\/[^>]+>/gi);
    const searchHtml = priceSection ? priceSection.join('') : html;

    // Pattern: NUMBER원 or NUMBER 원
    const pricePatterns = [
      /<strong[^>]*>([\d,]+)<\/strong>\s*원?/g,
      />([\d,]+)\s*원</g,
      /([\d,]+)\s*원/g,
    ];

    for (const pattern of pricePatterns) {
      let match;
      while ((match = pattern.exec(searchHtml)) !== null) {
        const contextStart = Math.max(0, match.index - 30);
        const context = searchHtml.slice(contextStart, match.index + match[0].length);

        if (unitPriceRe.test(context)) continue;
        if (context.includes('쿠폰할인') || context.includes('쿠폰적용')) continue;

        const value = parseKrwPrice(match[1]);
        if (value !== null && value >= 100 && !seen.has(value)) {
          seen.add(value);
          results.push({ value, text: match[1] });
        }
      }
    }

    return results;
  }

  /**
   * Select option by clicking
   */
  private async selectOptions(page: Page, labels: string[]): Promise<void> {
    const itemSelector = this.adapter.optionDetection.itemSelector;

    for (const label of labels) {
      await page.evaluate(
        (selector, targetLabel) => {
          const items = document.querySelectorAll(selector);
          for (const item of items) {
            const text = item.textContent?.trim();
            if (text === targetLabel) {
              (item as HTMLElement).click();
              break;
            }
          }
        },
        itemSelector,
        label
      );

      // Short delay between option selections
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  /**
   * Wait for price to update after option selection
   */
  private async waitForPriceUpdate(_page: Page): Promise<void> {
    // Random delay to mimic human behavior
    const delay = Math.floor(Math.random() * 500 + 300);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Determine overall page status from results
   */
  private determinePageStatus(results: ScrapeResult[]): string {
    const statuses = results.map((r) => r.status_code);

    if (statuses.every((s) => s === 'OK')) return 'OK';
    if (statuses.some((s) => s === 'OK')) return 'PARTIAL';
    if (statuses.some((s) => s === 'SOLD_OUT')) return 'SOLD_OUT';
    if (statuses.some((s) => s === 'BLOCKED')) return 'BLOCKED';
    if (statuses.some((s) => s === 'TIMEOUT')) return 'TIMEOUT';

    return 'FAIL_SELECTOR';
  }
}
