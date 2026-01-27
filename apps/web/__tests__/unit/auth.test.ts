import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateApiKey } from "@/lib/auth";

describe("validateApiKey", () => {
  beforeEach(() => {
    vi.stubEnv("EXTENSION_API_KEY", "test_secret_key");
  });

  it("should return true for valid API key", () => {
    const headers = new Headers({ "X-API-KEY": "test_secret_key" });
    expect(validateApiKey(headers)).toBe(true);
  });

  it("should return false for invalid API key", () => {
    const headers = new Headers({ "X-API-KEY": "wrong_key" });
    expect(validateApiKey(headers)).toBe(false);
  });

  it("should return false for missing API key header", () => {
    const headers = new Headers();
    expect(validateApiKey(headers)).toBe(false);
  });

  it("should return false when EXTENSION_API_KEY env is not set", () => {
    vi.stubEnv("EXTENSION_API_KEY", "");
    const headers = new Headers({ "X-API-KEY": "any_key" });
    expect(validateApiKey(headers)).toBe(false);
  });
});
