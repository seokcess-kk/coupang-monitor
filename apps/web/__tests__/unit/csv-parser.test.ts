import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/csv-parser";

describe("parseCsv", () => {
  it("should parse valid CSV with all columns", () => {
    const csv = `name,url,group,memo
상품A,https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522,식품,메모1
상품B,https://www.coupang.com/vp/products/1867265?itemId=21121876883&vendorItemId=3000107644,생활,메모2`;

    const result = parseCsv(csv);
    expect(result.items).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it("should extract name, group, memo from CSV", () => {
    const csv = `name,url,group,memo
상품A,https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522,식품,메모1`;

    const result = parseCsv(csv);
    expect(result.items[0].name).toBe("상품A");
    expect(result.items[0].group).toBe("식품");
    expect(result.items[0].memo).toBe("메모1");
  });

  it("should normalize URLs in parsed results", () => {
    const csv = `name,url,group,memo
상품A,https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522&q=test&rank=1,식품,`;

    const result = parseCsv(csv);
    expect(result.items[0].normalizedUrl).toBe(
      "https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522"
    );
    expect(result.items[0].dedupeKey).toBe("212842:9314840:3000290522");
  });

  it("should skip empty rows", () => {
    const csv = `name,url,group,memo
상품A,https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522,,

,,, `;

    const result = parseCsv(csv);
    expect(result.items).toHaveLength(1);
  });

  it("should report errors for invalid URLs", () => {
    const csv = `name,url,group,memo
상품A,https://www.google.com/invalid,식품,
상품B,https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522,,`;

    const result = parseCsv(csv);
    expect(result.items).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(2); // 1-indexed (header is row 1)
  });

  it("should detect duplicate URLs within same CSV", () => {
    const csv = `name,url,group,memo
상품A,https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522,,
상품B,https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522&q=different,,`;

    const result = parseCsv(csv);
    expect(result.items).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it("should handle CSV with only url column", () => {
    const csv = `url
https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522`;

    const result = parseCsv(csv);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBeUndefined();
  });

  it("should return error for empty CSV", () => {
    const result = parseCsv("");
    expect(result.items).toHaveLength(0);
  });

  it("should return error for CSV without url column", () => {
    const csv = `name,group,memo
상품A,식품,메모`;

    const result = parseCsv(csv);
    expect(result.items).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
