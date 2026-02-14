/**
 * Coupang-specific scraper adapter
 * CSS selectors and patterns for Coupang product pages
 */

import type { ScraperAdapter } from './adapter.interface.js';

export const coupangAdapter: ScraperAdapter = {
  name: 'coupang',

  priceSelectors: [
    // New Coupang structure (2024+) - final-price is the actual selling price
    '.final-price-amount',
    '[class*="final-price-amount"]',
    '.final-price .price-amount',
    // Sales price (middle priority)
    '.sales-price-amount',
    '[class*="sales-price-amount"]',
    '.sales-price .price-amount',
    // Legacy structure with strong tags
    '.prod-sale-price .total-price strong',
    '.prod-sale-price strong',
    '.total-price strong',
    // Fallback selectors
    '[class*="sale-price"] strong',
    '.prod-price strong',
    '[class*="final-price"] strong',
    '[class*="finalPrice"] strong',
    // Coupon price
    '.prod-coupon-price .total-price strong',
    '.prod-origin-price strong',
    '[class*="price-value"]',
    '[class*="priceValue"]',
    // Rocket delivery price
    '.prod-pdd-price strong',
    // Generic fallbacks
    '.price strong',
    'strong.price',
  ],

  optionDetection: {
    containerSelector: '[class*="option"]',
    groupTitleSelector: '[class*="title"], [class*="header"], [class*="label"]',
    itemSelector: 'button, li[role="option"], [class*="option-item"], [class*="chip"]',
  },

  nameSelectors: [
    '.prod-buy-header h1',
    '.prod-buy-header h2',
    '.prod-buy-header__title',
    'h1.prod-title',
    '[class*="product-title"]',
    '.product-title',
    'h1[class*="title"]',
  ],

  soldOutIndicators: {
    textPatterns: ['품절', '일시품절', 'sold out', '재입고 알림'],
    selectors: [
      '.oos-label',
      '.out-of-stock',
      '[class*="sold-out"]',
      '[class*="soldout"]',
      '.prod-not-available',
      '[class*="품절"]',
    ],
  },

  loadCompleteSelector: '.prod-buy-header, .prod-sale-price, .prod-price',

  blockIndicators: {
    selectors: [
      '[class*="captcha"]',
      '[class*="blocked"]',
      '#challenge-running',
    ],
    textPatterns: ['접근이 차단', 'blocked', 'captcha', '로봇'],
  },
};
