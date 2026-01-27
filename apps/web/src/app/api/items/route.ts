import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLowForPeriod } from "@/lib/metrics";

export async function GET() {
  const items = await prisma.item.findMany({
    orderBy: { createdAt: "desc" }
  });

  const results = await Promise.all(
    items.map(async (item) => {
      const variants = await prisma.variant.findMany({
        where: { itemId: item.id }
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

      const validSnapshots = latestSnapshots.filter(
        (entry): entry is NonNullable<typeof entry> => Boolean(entry)
      );
      const currentLow = validSnapshots.reduce<number | null>(
        (min, entry) => {
          if (entry.snapshot.price == null) {
            return min;
          }
          if (min == null || entry.snapshot.price < min) {
            return entry.snapshot.price;
          }
          return min;
        },
        null
      );
      const lowestVariant = validSnapshots.find(
        (entry) => entry.snapshot.price === currentLow
      );

      const low7d = await getLowForPeriod(item.id, 7);
      const low30d = await getLowForPeriod(item.id, 30);

      return {
        id: item.id,
        name: item.name,
        url: item.url,
        group: item.group,
        memo: item.memo,
        status: item.status,
        last_checked_at: item.lastCheckedAt,
        current_low: currentLow,
        lowest_variant: lowestVariant?.variant.optionKey ?? null,
        low_7d: low7d,
        low_30d: low30d
      };
    })
  );

  return NextResponse.json({ items: results });
}
