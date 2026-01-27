import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Body = {
  itemIds?: string[];
  mode: "all" | "selected";
  reason: "manual" | "scheduled";
  intervalMinutes?: 5 | 10 | 30 | 60;
};

function distributeSchedule(itemsCount: number, intervalMinutes: number) {
  const intervalMs = intervalMinutes * 60 * 1000;
  const spacing = itemsCount > 0 ? intervalMs / itemsCount : intervalMs;
  return (index: number) => new Date(Date.now() + index * spacing);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Body;
  if (!body?.mode || !body?.reason) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const items =
    body.mode === "all"
      ? await prisma.item.findMany()
      : await prisma.item.findMany({
          where: { id: { in: body.itemIds ?? [] } }
        });

  const intervalMinutes = body.intervalMinutes ?? 10;
  const scheduleForIndex = distributeSchedule(items.length, intervalMinutes);

  const jobs = await prisma.$transaction(
    items.map((item, index) =>
      prisma.job.create({
        data: {
          itemId: item.id,
          scheduledFor:
            body.reason === "scheduled"
              ? scheduleForIndex(index)
              : new Date(),
          status: "PENDING",
          reason: body.reason
        }
      })
    )
  );

  return NextResponse.json({
    count: jobs.length,
    scheduled: body.reason === "scheduled"
  });
}
