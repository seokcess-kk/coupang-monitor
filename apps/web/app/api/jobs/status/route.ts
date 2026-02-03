import { NextResponse } from "next/server";
import { prisma } from "@pricewatch/db";

export async function GET() {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const counts = await prisma.job.groupBy({
      by: ["status"],
      _count: { id: true },
      where: {
        createdAt: { gte: oneDayAgo },
      },
    });

    const result = {
      pending: 0,
      inProgress: 0,
      done: 0,
      failed: 0,
      total: 0,
    };

    for (const row of counts) {
      const count = row._count.id;
      result.total += count;

      if (row.status === "PENDING") {
        result.pending = count;
      } else if (row.status === "IN_PROGRESS") {
        result.inProgress = count;
      } else if (row.status === "DONE") {
        result.done = count;
      } else if (row.status === "FAILED") {
        result.failed = count;
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Job status error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
