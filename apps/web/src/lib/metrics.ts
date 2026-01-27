import { prisma } from "./prisma";

export function daysAgo(days: number) {
  const now = new Date();
  now.setDate(now.getDate() - days);
  return now;
}

export async function getLowForPeriod(
  itemId: string,
  days: number,
  before: Date = new Date()
) {
  const since = daysAgo(days);
  const result = await prisma.snapshot.aggregate({
    where: {
      variant: { itemId },
      checkedAt: { gte: since, lt: before },
      statusCode: "OK",
      price: { not: null }
    },
    _min: {
      price: true
    }
  });
  return result._min.price ?? null;
}
