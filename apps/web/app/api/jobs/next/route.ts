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
