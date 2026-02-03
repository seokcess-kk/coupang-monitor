import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pricewatch/db";

interface EnqueueBody {
  itemIds?: string[];
  mode: "all" | "selected";
  reason: "manual" | "scheduled";
}

export async function POST(request: NextRequest) {
  try {
    const body: EnqueueBody = await request.json();

    if (!body.mode || !["all", "selected"].includes(body.mode)) {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'all' or 'selected'" },
        { status: 400 }
      );
    }

    if (!body.reason || !["manual", "scheduled"].includes(body.reason)) {
      return NextResponse.json(
        { error: "Invalid reason. Must be 'manual' or 'scheduled'" },
        { status: 400 }
      );
    }

    if (body.mode === "selected" && (!body.itemIds || body.itemIds.length === 0)) {
      return NextResponse.json(
        { error: "itemIds required when mode is 'selected'" },
        { status: 400 }
      );
    }

    // Get target items
    const where = body.mode === "selected" && body.itemIds
      ? { id: { in: body.itemIds } }
      : {};

    const items = await prisma.item.findMany({ where, select: { id: true } });

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No items found" },
        { status: 404 }
      );
    }

    // Skip items that already have a PENDING or IN_PROGRESS job (중복 Job 방지)
    const existingJobs = await prisma.job.findMany({
      where: {
        itemId: { in: items.map((i) => i.id) },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      select: { itemId: true },
    });
    const existingItemIds = new Set(existingJobs.map((j) => j.itemId));

    const jobsToCreate = items
      .filter((i) => !existingItemIds.has(i.id))
      .map((i) => ({
        itemId: i.id,
        status: "PENDING",
        reason: body.reason,
      }));

    if (jobsToCreate.length > 0) {
      await prisma.job.createMany({ data: jobsToCreate });
    }

    return NextResponse.json({
      enqueued: jobsToCreate.length,
      skipped: existingItemIds.size,
      total: items.length,
    });
  } catch (err) {
    console.error("Job enqueue error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
