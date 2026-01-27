import { describe, it, expect } from "vitest";
import {
  computeCurrentLow,
  computePeriodLow,
  computeItemStats,
} from "@/lib/price-calculation";

describe("computeCurrentLow", () => {
  it("should return null for empty snapshots", () => {
    expect(computeCurrentLow([])).toBeNull();
  });

  it("should return the lowest price from latest snapshots per variant", () => {
    const snapshots = [
      { variantId: "v1", price: 15000, checkedAt: new Date("2026-01-27"), statusCode: "OK" },
      { variantId: "v1", price: 14000, checkedAt: new Date("2026-01-26"), statusCode: "OK" },
      { variantId: "v2", price: 12000, checkedAt: new Date("2026-01-27"), statusCode: "OK" },
    ];
    const result = computeCurrentLow(snapshots);
    expect(result?.price).toBe(12000);
    expect(result?.variantId).toBe("v2");
  });

  it("should ignore snapshots without price (null)", () => {
    const snapshots = [
      { variantId: "v1", price: null, checkedAt: new Date("2026-01-27"), statusCode: "SOLD_OUT" },
      { variantId: "v2", price: 12000, checkedAt: new Date("2026-01-27"), statusCode: "OK" },
    ];
    const result = computeCurrentLow(snapshots);
    expect(result?.price).toBe(12000);
  });
});

describe("computePeriodLow", () => {
  const now = new Date("2026-01-27T12:00:00Z");

  it("should return null for empty snapshots", () => {
    expect(computePeriodLow([], 7, now)).toBeNull();
  });

  it("should compute 7-day low", () => {
    const snapshots = [
      { variantId: "v1", price: 15000, checkedAt: new Date("2026-01-25"), statusCode: "OK" },
      { variantId: "v1", price: 13000, checkedAt: new Date("2026-01-22"), statusCode: "OK" },
      { variantId: "v1", price: 10000, checkedAt: new Date("2026-01-15"), statusCode: "OK" }, // outside 7d
    ];
    expect(computePeriodLow(snapshots, 7, now)).toBe(13000);
  });

  it("should compute 30-day low", () => {
    const snapshots = [
      { variantId: "v1", price: 15000, checkedAt: new Date("2026-01-25"), statusCode: "OK" },
      { variantId: "v1", price: 10000, checkedAt: new Date("2026-01-02"), statusCode: "OK" },
      { variantId: "v1", price: 9000, checkedAt: new Date("2025-12-20"), statusCode: "OK" }, // outside 30d
    ];
    expect(computePeriodLow(snapshots, 30, now)).toBe(10000);
  });

  it("should ignore null prices", () => {
    const snapshots = [
      { variantId: "v1", price: null, checkedAt: new Date("2026-01-25"), statusCode: "SOLD_OUT" },
      { variantId: "v1", price: 15000, checkedAt: new Date("2026-01-24"), statusCode: "OK" },
    ];
    expect(computePeriodLow(snapshots, 7, now)).toBe(15000);
  });
});

describe("computeItemStats", () => {
  it("should return default stats for item with no variants", () => {
    const stats = computeItemStats({ variants: [] });
    expect(stats.currentLow).toBeNull();
    expect(stats.low7d).toBeNull();
    expect(stats.low30d).toBeNull();
    expect(stats.lastCheckedAt).toBeNull();
    expect(stats.status).toBe("UNKNOWN");
  });

  it("should compute all stats from variants with snapshots", () => {
    const now = new Date("2026-01-27T12:00:00Z");
    const stats = computeItemStats({
      variants: [
        {
          id: "v1",
          optionKey: "3kg / 1개",
          snapshots: [
            { variantId: "v1", price: 15000, checkedAt: now, statusCode: "OK" },
            { variantId: "v1", price: 14000, checkedAt: new Date("2026-01-20"), statusCode: "OK" },
          ],
        },
        {
          id: "v2",
          optionKey: "5kg / 1개",
          snapshots: [
            { variantId: "v2", price: 12000, checkedAt: now, statusCode: "OK" },
          ],
        },
      ],
    }, now);

    expect(stats.currentLow).toBe(12000);
    expect(stats.lowestVariant).toBe("5kg / 1개");
    expect(stats.low7d).toBe(12000);
    expect(stats.low30d).toBe(12000);
    expect(stats.lastCheckedAt).toEqual(now);
    expect(stats.status).toBe("OK");
  });
});
