import { describe, it, expect } from "vitest";
import { parseKrwPrice } from "../src/content/price-extractor";

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
