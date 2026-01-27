import { describe, it, expect } from "vitest";
import { shouldCreatePriceEvent } from "@/lib/price-event";

describe("shouldCreatePriceEvent", () => {
  it("should detect 7d low", () => {
    const result = shouldCreatePriceEvent({
      newPrice: 10000,
      previousSnapshots: [
        { price: 15000, checkedAt: new Date("2026-01-25"), statusCode: "OK" },
        { price: 12000, checkedAt: new Date("2026-01-22"), statusCode: "OK" },
      ],
      now: new Date("2026-01-27T12:00:00Z"),
    });

    const event7d = result.find((e) => e.period === "7d");
    expect(event7d).toBeDefined();
    expect(event7d!.oldPrice).toBe(12000);
    expect(event7d!.newPrice).toBe(10000);
  });

  it("should detect 30d low", () => {
    const result = shouldCreatePriceEvent({
      newPrice: 9000,
      previousSnapshots: [
        { price: 15000, checkedAt: new Date("2026-01-25"), statusCode: "OK" },
        { price: 10000, checkedAt: new Date("2026-01-05"), statusCode: "OK" },
      ],
      now: new Date("2026-01-27T12:00:00Z"),
    });

    const event30d = result.find((e) => e.period === "30d");
    expect(event30d).toBeDefined();
    expect(event30d!.oldPrice).toBe(10000);
    expect(event30d!.newPrice).toBe(9000);
  });

  it("should return empty array when price is not a new low", () => {
    const result = shouldCreatePriceEvent({
      newPrice: 15000,
      previousSnapshots: [
        { price: 12000, checkedAt: new Date("2026-01-25"), statusCode: "OK" },
        { price: 10000, checkedAt: new Date("2026-01-22"), statusCode: "OK" },
      ],
      now: new Date("2026-01-27T12:00:00Z"),
    });

    expect(result).toHaveLength(0);
  });

  it("should return empty array for first snapshot (no history)", () => {
    const result = shouldCreatePriceEvent({
      newPrice: 15000,
      previousSnapshots: [],
      now: new Date("2026-01-27T12:00:00Z"),
    });

    expect(result).toHaveLength(0);
  });

  it("should detect both 7d and 30d low when applicable", () => {
    const result = shouldCreatePriceEvent({
      newPrice: 8000,
      previousSnapshots: [
        { price: 12000, checkedAt: new Date("2026-01-25"), statusCode: "OK" },
        { price: 10000, checkedAt: new Date("2026-01-05"), statusCode: "OK" },
      ],
      now: new Date("2026-01-27T12:00:00Z"),
    });

    expect(result).toHaveLength(2);
    expect(result.find((e) => e.period === "7d")).toBeDefined();
    expect(result.find((e) => e.period === "30d")).toBeDefined();
  });

  it("should detect only 7d low when 30d low is not broken", () => {
    const result = shouldCreatePriceEvent({
      newPrice: 11000,
      previousSnapshots: [
        { price: 12000, checkedAt: new Date("2026-01-25"), statusCode: "OK" },
        { price: 10000, checkedAt: new Date("2026-01-05"), statusCode: "OK" },
      ],
      now: new Date("2026-01-27T12:00:00Z"),
    });

    expect(result).toHaveLength(1);
    expect(result[0].period).toBe("7d");
  });
});
