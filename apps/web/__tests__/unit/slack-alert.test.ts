import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendSlackAlert, formatSlackMessage } from "@/lib/slack-alert";

describe("formatSlackMessage", () => {
  it("should format 7d low alert message", () => {
    const msg = formatSlackMessage({
      itemName: "나이키 에어맥스",
      optionKey: "270mm / 1개",
      oldPrice: 129000,
      newPrice: 109000,
      period: "7d",
      url: "https://www.coupang.com/vp/products/212842?itemId=9314840&vendorItemId=3000290522",
    });

    expect(msg).toContain("나이키 에어맥스");
    expect(msg).toContain("270mm / 1개");
    expect(msg).toContain("129,000");
    expect(msg).toContain("109,000");
    expect(msg).toContain("7일");
  });

  it("should format 30d low alert message", () => {
    const msg = formatSlackMessage({
      itemName: "상품B",
      optionKey: "default",
      oldPrice: 50000,
      newPrice: 40000,
      period: "30d",
      url: "https://www.coupang.com/vp/products/123",
    });

    expect(msg).toContain("30일");
  });
});

describe("sendSlackAlert", () => {
  beforeEach(() => {
    vi.stubEnv("SLACK_WEBHOOK_URL", "");
    global.fetch = vi.fn();
  });

  it("should skip when SLACK_WEBHOOK_URL is not set", async () => {
    await sendSlackAlert({
      itemName: "test",
      optionKey: "default",
      oldPrice: 100,
      newPrice: 90,
      period: "7d",
      url: "https://example.com",
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should call fetch when SLACK_WEBHOOK_URL is set", async () => {
    vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/test");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    await sendSlackAlert({
      itemName: "test",
      optionKey: "default",
      oldPrice: 100,
      newPrice: 90,
      period: "7d",
      url: "https://example.com",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/test",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });
});
