import { describe, it, expect } from "vitest";
import { buildOptionKey } from "../src/content/option-iterator";

describe("buildOptionKey", () => {
  it("should build key from single option", () => {
    expect(buildOptionKey(["3kg"])).toBe("3kg");
  });

  it("should build key from multiple options", () => {
    expect(buildOptionKey(["3kg", "1개"])).toBe("3kg / 1개");
  });

  it("should return 'default' for empty options", () => {
    expect(buildOptionKey([])).toBe("default");
  });

  it("should trim whitespace from option labels", () => {
    expect(buildOptionKey(["  3kg  ", "  1개  "])).toBe("3kg / 1개");
  });
});
