import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pricewatch/db";
import { computeItemStats } from "@/lib/price-calculation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        variants: {
          include: {
            snapshots: {
              where: { checkedAt: { gte: thirtyDaysAgo } },
              orderBy: { checkedAt: "desc" },
            },
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

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
      }
    );

    return NextResponse.json({
      id: item.id,
      name: item.name,
      url: item.url,
      group: item.group,
      memo: item.memo,
      ...stats,
      variants: item.variants.map((v) => {
        const latestSnapshot = v.snapshots[0] ?? null;
        return {
          id: v.id,
          optionKey: v.optionKey,
          active: v.active,
          currentPrice: latestSnapshot?.price ?? null,
          currentStatus: latestSnapshot?.statusCode ?? "UNKNOWN",
          lastCheckedAt: latestSnapshot?.checkedAt ?? null,
          snapshotCount: v.snapshots.length,
        };
      }),
      snapshots: item.variants.flatMap((v) =>
        v.snapshots.map((s) => ({
          id: s.id,
          variantId: s.variantId,
          optionKey: v.optionKey,
          price: s.price,
          statusCode: s.statusCode,
          checkedAt: s.checkedAt,
        }))
      ).sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()),
    });
  } catch (err) {
    console.error("Item detail error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if item exists
    const item = await prisma.item.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    // Delete item (cascades to variants and snapshots due to schema)
    await prisma.item.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Item delete error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
