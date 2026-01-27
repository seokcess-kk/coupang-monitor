import { NextResponse } from "next/server";
import { prisma } from "@pricewatch/db";
import { computeItemStats } from "@/lib/price-calculation";

export async function GET() {
  try {
    const items = await prisma.item.findMany({
      include: {
        variants: {
          include: {
            snapshots: {
              orderBy: { checkedAt: "desc" },
              take: 100,
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
