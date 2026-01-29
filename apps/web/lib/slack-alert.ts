import { formatPriceNumber } from "./format";

interface SlackAlertInput {
  itemName: string;
  optionKey: string;
  oldPrice: number;
  newPrice: number;
  period: "7d" | "30d" | string;
  url: string;
}

function periodLabel(period: string): string {
  if (period === "7d") return "7일";
  if (period === "30d") return "30일";
  return period;
}

export function formatSlackMessage(input: SlackAlertInput): string {
  const diff = input.oldPrice - input.newPrice;
  const pct = ((diff / input.oldPrice) * 100).toFixed(1);

  return [
    `*${input.itemName}* — ${periodLabel(input.period)} 신저가!`,
    `옵션: ${input.optionKey}`,
    `이전 최저: ${formatPriceNumber(input.oldPrice)}원 → *${formatPriceNumber(input.newPrice)}원* (-${formatPriceNumber(diff)}원, -${pct}%)`,
    `<${input.url}|쿠팡에서 보기>`,
  ].join("\n");
}

export async function sendSlackAlert(input: SlackAlertInput): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const text = formatSlackMessage(input);

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("Slack alert error:", err);
  }
}
