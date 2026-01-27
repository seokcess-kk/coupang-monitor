import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@pricewatch/db";
import { parseCsv } from "@/lib/csv-parser";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let csvText: string;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }
      csvText = await file.text();
    } else {
      csvText = await request.text();
    }

    if (!csvText.trim()) {
      return NextResponse.json(
        { error: "Empty CSV" },
        { status: 400 }
      );
    }

    const parsed = parseCsv(csvText);

    if (parsed.items.length === 0 && parsed.errors.length > 0) {
      return NextResponse.json(
        { error: "Invalid CSV", details: parsed.errors },
        { status: 400 }
      );
    }

    let created = 0;
    let skipped = 0;

    for (const item of parsed.items) {
      const existing = await prisma.item.findUnique({
        where: { dedupeKey: item.dedupeKey },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.item.create({
        data: {
          name: item.name,
          url: item.normalizedUrl,
          productId: item.productId,
          itemId: item.itemId,
          vendorItemId: item.vendorItemId,
          dedupeKey: item.dedupeKey,
          group: item.group,
          memo: item.memo,
        },
      });
      created++;
    }

    return NextResponse.json(
      {
        created,
        skipped,
        duplicatesInCsv: parsed.duplicates.length,
        errors: parsed.errors,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("CSV upload error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
