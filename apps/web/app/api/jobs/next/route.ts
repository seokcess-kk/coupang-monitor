import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pricewatch/db";
import { validateApiKey } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request.headers)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // 10분 이상 IN_PROGRESS 상태인 Job을 PENDING으로 복구 (고착된 Job 자동 복구)
    const staleTimeout = new Date(Date.now() - 10 * 60 * 1000);
    const staleRecovered = await prisma.job.updateMany({
      where: {
        status: "IN_PROGRESS",
        updatedAt: { lt: staleTimeout },
      },
      data: { status: "PENDING" },
    });

    if (staleRecovered.count > 0) {
      console.log(`Recovered ${staleRecovered.count} stale IN_PROGRESS jobs`);
    }

    // Find next pending job, ordered by scheduledFor
    const job = await prisma.job.findFirst({
      where: { status: "PENDING" },
      orderBy: { scheduledFor: "asc" },
      include: {
        item: {
          select: {
            id: true,
            url: true,
            name: true,
            variantCursor: true,
          },
        },
      },
    });

    if (!job) {
      return new NextResponse(null, { status: 204 });
    }

    // Mark as in-progress by updating status
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "IN_PROGRESS" },
    });

    return NextResponse.json({
      jobId: job.id,
      itemId: job.item.id,
      url: job.item.url,
      name: job.item.name,
      variantCursor: job.item.variantCursor,
      variantsPerRun: parseInt(process.env.DEFAULT_VARIANT_PER_RUN ?? "15", 10),
      pageTimeoutMs: parseInt(process.env.PAGE_TIMEOUT_MS ?? "20000", 10),
    });
  } catch (err) {
    console.error("Job next error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
