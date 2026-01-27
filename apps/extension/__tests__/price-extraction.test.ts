import { describe, it, expect } from "vitest";
import { extractPrice, parseKrwPrice } from "../src/content/price-extractor";

describe("parseKrwPrice", () => {
  it("should parse simple price string", () => {
    expect(parseKrwPrice("14,650원")).toBe(14650);
  });

  it("should parse price without 원", () => {
    expect(parseKrwPrice("14,650")).toBe(14650);
  });

  it("should parse price without comma", () => {
    expect(parseKrwPrice("14650원")).toBe(14650);
  });

  it("should return null for non-price text", () => {
    expect(parseKrwPrice("25%")).toBeNull();
  });

  it("should return null for unit price text", () => {
    expect(parseKrwPrice("100g당 993원")).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(parseKrwPrice("")).toBeNull();
  });
});

describe("extractPrice", () => {
  it("should extract price from 쿠팡판매가 label (Priority A)", () => {
    const html = `
      <div class="prod-sale-price">
        <span class="price-label">쿠팡판매가</span>
        <span class="total-price"><strong>14,650</strong>원</span>
      </div>
      <div class="coupon-price">
        <span>쿠폰할인</span>
        <span>1,000원</span>
      </div>
    `;
    const result = extractPrice(html);
    expect(result.price).toBe(14650);
    expect(result.statusCode).toBe("OK");
  });

  it("should extract final displayed price when no 쿠팡판매가 (Priority B)", () => {
    const html = `
      <div class="prod-sale-price">
        <span class="origin-price">19,900원</span>
        <span class="total-price"><strong>14,900</strong>원</span>
      </div>
    `;
    const result = extractPrice(html);
    expect(result.price).toBe(14900);
    expect(result.statusCode).toBe("OK");
  });

  it("should exclude unit prices (100g당)", () => {
    const html = `
      <div class="prod-sale-price">
        <span class="total-price"><strong>14,900</strong>원</span>
        <span class="unit-price">100g당 993원</span>
      </div>
    `;
    const result = extractPrice(html);
    expect(result.price).toBe(14900);
  });

  it("should detect SOLD_OUT", () => {
    const html = `
      <div class="oos-label">품절</div>
    `;
    const result = extractPrice(html);
    expect(result.statusCode).toBe("SOLD_OUT");
    expect(result.price).toBeNull();
  });

  it("should return FAIL_SELECTOR when no price found", () => {
    const html = `<div>No price information here</div>`;
    const result = extractPrice(html);
    expect(result.statusCode).toBe("FAIL_SELECTOR");
    expect(result.price).toBeNull();
  });
});
