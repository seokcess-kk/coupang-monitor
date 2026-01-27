import { describe, it, expect } from "vitest";
import { normalizeUrl } from "../src/url-normalization";

describe("normalizeUrl", () => {
  it("should extract productId, itemId, vendorItemId from full URL", () => {
    const result = normalizeUrl(
      "https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522"
    );
    expect(result.productId).toBe("212842");
    expect(result.itemId).toBe("9314840");
    expect(result.vendorItemId).toBe("3000290522");
  });

  it("should produce canonical URL", () => {
    const result = normalizeUrl(
      "https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522"
    );
    expect(result.url).toBe(
      "https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522"
    );
  });

  it("should produce dedupeKey", () => {
    const result = normalizeUrl(
      "https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522"
    );
    expect(result.dedupeKey).toBe("212842:9314840:3000290522");
  });

  it("should strip tracking params (q, searchId, rank, traceId, etc.)", () => {
    const result = normalizeUrl(
      "https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522&q=%EB%82%98%EC%9D%B4%ED%82%A4&searchId=abc123&rank=1&traceId=xyz&sourceType=srp&itemsCount=36&searchRank=1"
    );
    expect(result.url).toBe(
      "https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522"
    );
    expect(result.dedupeKey).toBe("212842:9314840:3000290522");
  });

  it("should handle URL with large IDs", () => {
    const result = normalizeUrl(
      "https://www.coupang.com/vp/products/4788701784?itemId=6132225851&vendorItemId=88470546639&q=test&rank=9"
    );
    expect(result.productId).toBe("4788701784");
    expect(result.itemId).toBe("6132225851");
    expect(result.vendorItemId).toBe("88470546639");
    expect(result.url).toBe(
      "https://www.coupang.com/vp/products/4788701784?itemId=6132225851&vendorItemId=88470546639"
    );
  });

  it("should handle URL without vendorItemId", () => {
    const result = normalizeUrl(
      "https://www.coupang.com/vp/products/212842?itemId=9314840"
    );
    expect(result.productId).toBe("212842");
    expect(result.itemId).toBe("9314840");
    expect(result.vendorItemId).toBe("");
    expect(result.dedupeKey).toBe("212842:9314840:");
    expect(result.url).toBe(
      "https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId="
    );
  });

  it("should handle m.coupang.com mobile URLs", () => {
    const result = normalizeUrl(
      "https://m.coupang.com/vm/products/212842?itemId=9314840&vendorItemId=3000290522"
    );
    expect(result.productId).toBe("212842");
    expect(result.url).toContain("www.coupang.com/vp/products/212842");
  });

  it("should throw on invalid URL (not coupang)", () => {
    expect(() => normalizeUrl("https://www.google.com")).toThrow();
  });

  it("should throw on URL without productId", () => {
    expect(() =>
      normalizeUrl("https://www.coupang.com/vp/products/")
    ).toThrow();
  });

  it("should throw on URL without itemId", () => {
    expect(() =>
      normalizeUrl("https://www.coupang.com/vp/products/212842")
    ).toThrow();
  });

  it("should handle http:// protocol", () => {
    const result = normalizeUrl(
      "http://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522"
    );
    expect(result.url.startsWith("https://")).toBe(true);
  });

  it("should handle params in any order", () => {
    const result = normalizeUrl(
      "https://www.coupang.com/vp/products/212842?vendorItemId=3000290522&q=test&itemId=9314840"
    );
    expect(result.productId).toBe("212842");
    expect(result.itemId).toBe("9314840");
    expect(result.vendorItemId).toBe("3000290522");
  });
});
