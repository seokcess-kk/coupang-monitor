import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pricewatch/db";
import { validateApiKey } from "@/lib/auth";
import { shouldCreatePriceEvent } from "@/lib/price-event";
import { sendSlackAlert } from "@/lib/slack-alert";

interface VariantResult {
  option_key: string;
  price: number | null;
  status_code: string;
  raw_price_text?: string;
}

interface BatchBody {
  job_id: string;
  item_id: string;
  url: string;
  results: VariantResult[];
  page_status_code: string;
  checked_at: string;
  variant_cursor?: number;
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request.headers)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body: BatchBody = await request.json();

    if (!body.item_id || !body.results || !Array.isArray(body.results)) {
      return NextResponse.json(
        { error: "Missing required fields: item_id, results" },
        { status: 400 }
      );
    }

    const checkedAt = body.checked_at ? new Date(body.checked_at) : new Date();
    const now = new Date();

    const item = await prisma.item.findUnique({
      where: { id: body.item_id },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    let snapshotsCreated = 0;
    let variantsCreated = 0;
    let eventsCreated = 0;

    for (const result of body.results) {
      // Upsert variant
      let variant = await prisma.variant.findUnique({
        where: {
          itemId_optionKey: {
            itemId: body.item_id,
            optionKey: result.option_key,
          },
        },
      });

      if (!variant) {
        variant = await prisma.variant.create({
          data: {
            itemId: body.item_id,
            optionKey: result.option_key,
          },
        });
        variantsCreated++;
      }

      // Create snapshot
      await prisma.snapshot.create({
        data: {
          variantId: variant.id,
          price: result.price,
          statusCode: result.status_code,
          rawPriceText: result.raw_price_text,
          checkedAt,
        },
      });
      snapshotsCreated++;

      // Detect price events
      if (result.price != null && result.status_code === "OK") {
        const previousSnapshots = await prisma.snapshot.findMany({
          where: {
            variantId: variant.id,
            checkedAt: {
              lt: checkedAt,
              gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
            },
            price: { not: null },
          },
          select: { price: true, checkedAt: true, statusCode: true },
        });

        const events = shouldCreatePriceEvent({
          newPrice: result.price,
          previousSnapshots: previousSnapshots.map((s) => ({
            price: s.price,
            checkedAt: s.checkedAt,
            statusCode: s.statusCode,
          })),
          now,
        });

        for (const event of events) {
          await prisma.priceEvent.create({
            data: {
              itemId: body.item_id,
              variantId: variant.id,
              oldPrice: event.oldPrice,
              newPrice: event.newPrice,
              period: event.period,
            },
          });
          eventsCreated++;

          // Send Slack alert
          await sendSlackAlert({
            itemName: item.name ?? item.url,
            optionKey: result.option_key,
            oldPrice: event.oldPrice,
            newPrice: event.newPrice,
            period: event.period,
            url: item.url,
          });
        }
      }
    }

    // Update variant cursor
    if (body.variant_cursor != null) {
      await prisma.item.update({
        where: { id: body.item_id },
        data: { variantCursor: body.variant_cursor },
      });
    }

    // Update job status
    if (body.job_id) {
      await prisma.job.update({
        where: { id: body.job_id },
        data: { status: "DONE" },
      });
    }

    return NextResponse.json({
      snapshotsCreated,
      variantsCreated,
      eventsCreated,
    });
  } catch (err) {
    console.error("Snapshot batch error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
