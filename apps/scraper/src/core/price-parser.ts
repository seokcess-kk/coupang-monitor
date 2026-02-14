/**
 * Price parsing utilities
 * Ported from apps/extension/src/content/price-extractor.ts
 */

import type { PriceResult, StatusCode } from './types.js';

const UNIT_PRICE_RE = /\d+[gml]당|\d+ml당|\d+g당/i;
const KRW_PRICE_RE = /[\d,]+/;

/**
 * Parse Korean Won price from text
 * Filters out percentages and unit prices
 */
export function parseKrwPrice(text: string): number | null {
  if (!text || text.trim() === '') return null;

  const trimmed = text.trim();

  // Exclude percentages
  if (trimmed.includes('%')) return null;

  // Exclude unit prices (100g당, 100ml당, etc.)
  if (UNIT_PRICE_RE.test(trimmed)) return null;

  const match = trimmed.match(KRW_PRICE_RE);
  if (!match) return null;

  const num = parseInt(match[0].replace(/,/g, ''), 10);
  if (isNaN(num) || num === 0) return null;

  return num;
}

/**
 * Check if price text is valid (not unit price, not coupon, etc.)
 */
export function isValidPriceContext(context: string): boolean {
  if (UNIT_PRICE_RE.test(context)) return false;
  if (context.includes('쿠폰할인') || context.includes('쿠폰')) return false;
  return true;
}

interface PriceCandidate {
  value: number;
  text: string;
}

function extractStrongPrices(html: string): PriceCandidate[] {
  const results: PriceCandidate[] = [];
  const pattern = /<strong[^>]*>([\d,]+)<\/strong>\s*원?/g;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    const contextStart = Math.max(0, match.index - 30);
    const context = html.slice(contextStart, match.index + match[0].length);

    if (!isValidPriceContext(context)) continue;

    const value = parseKrwPrice(match[1]);
    if (value !== null) {
      results.push({ value, text: match[0] });
    }
  }

  return results;
}

function extractAllPrices(html: string): PriceCandidate[] {
  const results: PriceCandidate[] = [];
  const pricePatterns = [
    /<strong[^>]*>([\d,]+)<\/strong>\s*원/g,
    />([\d,]+)\s*원</g,
    /([\d,]+)\s*원/g,
  ];

  const seen = new Set<number>();

  for (const pattern of pricePatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const contextStart = Math.max(0, match.index - 20);
      const context = html.slice(contextStart, match.index + match[0].length);

      if (!isValidPriceContext(context)) continue;

      const value = parseKrwPrice(match[1]);
      if (value !== null && !seen.has(value)) {
        seen.add(value);
        results.push({ value, text: match[0] });
      }
    }
  }

  return results;
}

/**
 * Extract price from new Coupang HTML structure (2024+)
 * Looks for final-price-amount or sales-price-amount classes
 */
function extractFinalPriceFromHtml(html: string): PriceCandidate | null {
  // Pattern for final-price-amount or sales-price-amount class
  const patterns = [
    /class="[^"]*final-price-amount[^"]*"[^>]*>([\d,]+)원?</gi,
    /class="[^"]*sales-price-amount[^"]*"[^>]*>([\d,]+)원?</gi,
    /final-price[^>]*>[\s\S]*?([\d,]+)원/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) {
      const value = parseKrwPrice(match[1]);
      if (value !== null) {
        return { value, text: match[1] };
      }
    }
  }

  return null;
}

/**
 * Extract price from HTML string
 * Uses priority-based strategy:
 * 1. final-price-amount (new Coupang structure 2024+)
 * 2. "쿠팡판매가" label
 * 3. <strong> tagged prices
 * 4. All prices (fallback)
 */
export function extractPrice(html: string): PriceResult {
  // Check for sold out
  if (html.includes('품절') || html.includes('일시품절')) {
    return { price: null, statusCode: 'SOLD_OUT', rawPriceText: '' };
  }

  // Priority A: New Coupang structure - final-price-amount
  const finalPrice = extractFinalPriceFromHtml(html);
  if (finalPrice) {
    return {
      price: finalPrice.value,
      statusCode: 'OK',
      rawPriceText: finalPrice.text,
    };
  }

  // Priority B: Look for "쿠팡판매가" label
  const coupangSalePriceIdx = html.indexOf('쿠팡판매가');
  if (coupangSalePriceIdx !== -1) {
    const afterLabel = html.slice(coupangSalePriceIdx);
    const prices = extractAllPrices(afterLabel);
    if (prices.length > 0) {
      return {
        price: prices[0].value,
        statusCode: 'OK',
        rawPriceText: prices[0].text,
      };
    }
  }

  // Priority C: Use final displayed price in price block
  const strongPrices = extractStrongPrices(html);
  if (strongPrices.length > 0) {
    const finalStrong = strongPrices[strongPrices.length - 1];
    return {
      price: finalStrong.value,
      statusCode: 'OK',
      rawPriceText: finalStrong.text,
    };
  }

  // Fallback: all prices
  const allPrices = extractAllPrices(html);
  const validPrices = allPrices.filter((p) => p.value !== null);

  if (validPrices.length === 0) {
    return { price: null, statusCode: 'FAIL_SELECTOR', rawPriceText: '' };
  }

  const lastPrice = validPrices[validPrices.length - 1];
  return {
    price: lastPrice.value,
    statusCode: 'OK',
    rawPriceText: lastPrice.text,
  };
}
