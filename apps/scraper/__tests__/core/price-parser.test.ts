/**
 * Price parser tests
 */

import { describe, it, expect } from 'vitest';
import { parseKrwPrice, extractPrice, isValidPriceContext } from '../../src/core/price-parser.js';

describe('parseKrwPrice', () => {
  it('parses comma-separated prices', () => {
    expect(parseKrwPrice('14,650')).toBe(14650);
    expect(parseKrwPrice('1,234,567')).toBe(1234567);
  });

  it('parses prices with 원 suffix', () => {
    expect(parseKrwPrice('14,650원')).toBe(14650);
    expect(parseKrwPrice('19,900 원')).toBe(19900);
  });

  it('returns null for percentages', () => {
    expect(parseKrwPrice('25%')).toBeNull();
    expect(parseKrwPrice('50% 할인')).toBeNull();
  });

  it('returns null for unit prices', () => {
    expect(parseKrwPrice('100g당 993원')).toBeNull();
    expect(parseKrwPrice('100ml당 590원')).toBeNull();
  });

  it('returns null for empty/invalid input', () => {
    expect(parseKrwPrice('')).toBeNull();
    expect(parseKrwPrice('   ')).toBeNull();
    expect(parseKrwPrice('abc')).toBeNull();
  });
});

describe('isValidPriceContext', () => {
  it('returns true for valid price context', () => {
    expect(isValidPriceContext('판매가 14,650원')).toBe(true);
    expect(isValidPriceContext('19,900원')).toBe(true);
  });

  it('returns false for unit prices', () => {
    expect(isValidPriceContext('100g당 993원')).toBe(false);
    expect(isValidPriceContext('100ml당')).toBe(false);
  });

  it('returns false for coupon-related text', () => {
    expect(isValidPriceContext('쿠폰할인 1,000원')).toBe(false);
    expect(isValidPriceContext('쿠폰 적용')).toBe(false);
  });
});

describe('extractPrice', () => {
  it('extracts price near 쿠팡판매가 label', () => {
    const html = '<div>쿠팡판매가<strong>14,650</strong>원</div>';
    const result = extractPrice(html);
    expect(result.price).toBe(14650);
    expect(result.statusCode).toBe('OK');
  });

  it('returns SOLD_OUT for 품절 pages', () => {
    const html = '<div>이 상품은 품절입니다</div>';
    const result = extractPrice(html);
    expect(result.price).toBeNull();
    expect(result.statusCode).toBe('SOLD_OUT');
  });

  it('extracts strong-tagged prices', () => {
    const html = '<div class="price"><strong>19,900</strong>원</div>';
    const result = extractPrice(html);
    expect(result.price).toBe(19900);
    expect(result.statusCode).toBe('OK');
  });

  it('returns FAIL_SELECTOR when no price found', () => {
    const html = '<div>No price here</div>';
    const result = extractPrice(html);
    expect(result.price).toBeNull();
    expect(result.statusCode).toBe('FAIL_SELECTOR');
  });

  it('skips coupon prices', () => {
    const html = `
      <div>쿠폰할인<strong>1,000</strong>원</div>
      <div class="price"><strong>14,650</strong>원</div>
    `;
    const result = extractPrice(html);
    expect(result.price).toBe(14650);
  });

  it('extracts price from new Coupang final-price-amount structure', () => {
    const html = `
      <div class="price-container">
        <div class="original-price">
          <div>6%</div>
          <div class="price-amount original-price-amount" style="text-decoration:line-through">529,000원</div>
        </div>
        <div class="final-price">
          <div class="price-amount final-price-amount">497,260원</div>
        </div>
      </div>
    `;
    const result = extractPrice(html);
    expect(result.price).toBe(497260);
    expect(result.statusCode).toBe('OK');
  });

  it('extracts price from sales-price-amount structure', () => {
    const html = `
      <div class="sales-price">
        <div class="price-amount sales-price-amount">123,456원</div>
      </div>
    `;
    const result = extractPrice(html);
    expect(result.price).toBe(123456);
    expect(result.statusCode).toBe('OK');
  });

  it('prefers final-price over original-price', () => {
    const html = `
      <div class="original-price">
        <div class="price-amount original-price-amount">1,000,000원</div>
      </div>
      <div class="final-price">
        <div class="price-amount final-price-amount">500,000원</div>
      </div>
    `;
    const result = extractPrice(html);
    // Should get final price, not original
    expect(result.price).toBe(500000);
  });
});
