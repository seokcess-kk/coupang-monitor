import { NextRequest, NextResponse } from "next/server";
import { prisma, normalizeUrl } from "@pricewatch/db";
import { computeItemStats } from "@/lib/price-calculation";

export async function GET() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const items = await prisma.item.findMany({
      include: {
        variants: {
          select: {
            id: true,
            optionKey: true,
            snapshots: {
              where: {
                checkedAt: { gte: thirtyDaysAgo },
              },
              orderBy: { checkedAt: "desc" },
              select: {
                variantId: true,
                price: true,
                statusCode: true,
                checkedAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const result = items.map((item) => {
      const stats = computeItemStats(
        {
          variants: item.variants.map((v) => ({
            id: v.id,
            optionKey: v.optionKey,
            snapshots: v.snapshots.map((s) => ({
              variantId: s.variantId,
              price: s.price,
              checkedAt: s.checkedAt,
              statusCode: s.statusCode,
            })),
          })),
        },
        now
      );

      return {
        id: item.id,
        name: item.name,
        url: item.url,
        group: item.group,
        memo: item.memo,
        currentLow: stats.currentLow,
        lowestVariant: stats.lowestVariant,
        low7d: stats.low7d,
        low30d: stats.low30d,
        lastCheckedAt: stats.lastCheckedAt,
        status: stats.status,
        variantCount: item.variants.length,
        createdAt: item.createdAt,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Items list error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, name, group, memo } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Normalize URL
    let normalized;
    try {
      normalized = normalizeUrl(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid URL";
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.item.findUnique({
      where: { dedupeKey: normalized.dedupeKey },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This item already exists", existingId: existing.id },
        { status: 409 }
      );
    }

    // Create item
    const item = await prisma.item.create({
      data: {
        url: normalized.url,
        dedupeKey: normalized.dedupeKey,
        name: name || null,
        group: group || null,
        memo: memo || null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("Item create error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
