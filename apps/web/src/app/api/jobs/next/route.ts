import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.EXTENSION_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const job = await prisma.job.findFirst({
    where: {
      status: "PENDING",
      scheduledFor: { lte: now }
    },
    orderBy: { scheduledFor: "asc" },
    include: { item: true }
  });

  if (!job) {
    return NextResponse.json({ job: null });
  }

  const updated = await prisma.job.update({
    where: { id: job.id },
    data: { status: "IN_PROGRESS", startedAt: new Date() }
  });

  return NextResponse.json({
    job: {
      id: updated.id,
      item_id: job.item.id,
      url: job.item.url,
      variant_cursor: job.item.variantCursor,
      variant_limit: Number(process.env.DEFAULT_VARIANT_PER_RUN ?? 15),
      page_timeout_ms: Number(process.env.PAGE_TIMEOUT_MS ?? 20000)
    }
  });
}
