import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLowForPeriod } from "@/lib/metrics";

type Params = {
  params: { id: string };
};

export async function GET(_: Request, { params }: Params) {
  const item = await prisma.item.findUnique({
    where: { id: params.id }
  });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const variants = await prisma.variant.findMany({
    where: { itemId: item.id },
    orderBy: { optionKey: "asc" }
  });

  const latestSnapshots = await Promise.all(
    variants.map(async (variant) => {
      const snapshot = await prisma.snapshot.findFirst({
        where: { variantId: variant.id },
        orderBy: { checkedAt: "desc" }
      });
      return snapshot ? { variant, snapshot } : null;
    })
  );

  const currentLow = latestSnapshots.reduce<number | null>((min, entry) => {
    if (!entry || entry.snapshot.price == null) {
      return min;
    }
    if (min == null || entry.snapshot.price < min) {
      return entry.snapshot.price;
    }
    return min;
  }, null);

  const [low7d, low30d] = await Promise.all([
    getLowForPeriod(item.id, 7),
    getLowForPeriod(item.id, 30)
  ]);

  const snapshots = await prisma.snapshot.findMany({
    where: {
      variant: { itemId: item.id },
      checkedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    },
    orderBy: { checkedAt: "asc" }
  });

  const dailyMap = new Map<string, number>();
  for (const snap of snapshots) {
    if (snap.price == null) {
      continue;
    }
    const key = snap.checkedAt.toISOString().slice(0, 10);
    const existing = dailyMap.get(key);
    if (existing == null || snap.price < existing) {
      dailyMap.set(key, snap.price);
    }
  }

  const series = Array.from(dailyMap.entries()).map(([date, price]) => ({
    date,
    price
  }));

  return NextResponse.json({
    item: {
      ...item,
      current_low: currentLow,
      low_7d: low7d,
      low_30d: low30d
    },
    variants,
    series
  });
}
