import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLowForPeriod } from "@/lib/metrics";
import { sendSlackAlert } from "@/lib/slack";

type SnapshotResult = {
  option_key: string;
  price?: number | null;
  status_code: string;
  raw_price_text?: string;
};

type Body = {
  job_id?: string;
  item_id: string;
  url: string;
  results: SnapshotResult[];
  page_status_code: string;
  checked_at: string;
  next_cursor?: number;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Body;
  if (!body?.item_id || !body?.results?.length) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const item = await prisma.item.findUnique({
    where: { id: body.item_id }
  });

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const checkedAt = body.checked_at ? new Date(body.checked_at) : new Date();

  for (const result of body.results) {
    const variant = await prisma.variant.upsert({
      where: {
        itemId_optionKey: { itemId: item.id, optionKey: result.option_key }
      },
      update: { active: true },
      create: {
        itemId: item.id,
        optionKey: result.option_key
      }
    });

    if (result.price != null && result.status_code === "OK") {
      const [low7d, low30d] = await Promise.all([
        getLowForPeriod(item.id, 7, checkedAt),
        getLowForPeriod(item.id, 30, checkedAt)
      ]);

      if (low7d != null && result.price < low7d) {
        await prisma.priceEvent.create({
          data: {
            itemId: item.id,
            variantId: variant.id,
            oldPrice: low7d,
            newPrice: result.price,
            period: "7d"
          }
        });
        await sendSlackAlert(
          `7D LOW 갱신: ${item.url}\n옵션: ${result.option_key}\n${low7d} → ${result.price}`
        );
      }

      if (low30d != null && result.price < low30d) {
        await prisma.priceEvent.create({
          data: {
            itemId: item.id,
            variantId: variant.id,
            oldPrice: low30d,
            newPrice: result.price,
            period: "30d"
          }
        });
        await sendSlackAlert(
          `30D LOW 갱신: ${item.url}\n옵션: ${result.option_key}\n${low30d} → ${result.price}`
        );
      }
    }

    await prisma.snapshot.create({
      data: {
        variantId: variant.id,
        price: result.price ?? null,
        statusCode: result.status_code,
        rawPriceText: result.raw_price_text,
        pageStatusCode: body.page_status_code,
        checkedAt
      }
    });
  }

  await prisma.item.update({
    where: { id: item.id },
    data: {
      variantCursor:
        body.next_cursor ?? item.variantCursor + body.results.length,
      lastCheckedAt: checkedAt,
      status: body.page_status_code
    }
  });

  if (body.job_id) {
    await prisma.job.update({
      where: { id: body.job_id },
      data: { status: "DONE", completedAt: new Date() }
    });
  }

  return NextResponse.json({ ok: true });
}
