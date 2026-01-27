import { NextRequest, NextResponse } from "next/server";
import { parseCsv } from "@/lib/csv";
import { normalizeCoupangUrl } from "@/lib/url";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const text =
    contentType.includes("application/json")
      ? (await request.json())?.csv ?? ""
      : await request.text();

  if (!text) {
    return NextResponse.json(
      { error: "CSV content missing" },
      { status: 400 }
    );
  }

  const rows = parseCsv(text);
  const errors: string[] = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const normalized = normalizeCoupangUrl(row.url);
    if (!normalized) {
      errors.push(`Invalid URL: ${row.url}`);
      skipped += 1;
      continue;
    }
    const existing = await prisma.item.findUnique({
      where: { itemKey: normalized.itemKey }
    });
    if (existing) {
      await prisma.item.update({
        where: { itemKey: normalized.itemKey },
        data: {
          name: row.name ?? existing.name,
          url: normalized.canonicalUrl,
          group: row.group ?? existing.group,
          memo: row.memo ?? existing.memo,
          productId: normalized.productId,
          itemId: normalized.itemId,
          vendorItemId: normalized.vendorItemId
        }
      });
      updated += 1;
    } else {
      await prisma.item.create({
        data: {
          name: row.name,
          url: normalized.canonicalUrl,
          group: row.group,
          memo: row.memo,
          productId: normalized.productId,
          itemId: normalized.itemId,
          vendorItemId: normalized.vendorItemId,
          itemKey: normalized.itemKey
        }
      });
      inserted += 1;
    }
  }

  return NextResponse.json({ inserted, updated, skipped, errors });
}
