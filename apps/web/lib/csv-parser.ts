import { normalizeUrl } from "@pricewatch/db";

export interface ParsedItem {
  name?: string;
  url: string;
  normalizedUrl: string;
  dedupeKey: string;
  productId: string;
  itemId: string;
  vendorItemId: string;
  group?: string;
  memo?: string;
}

export interface CsvError {
  row: number;
  message: string;
}

export interface CsvParseResult {
  items: ParsedItem[];
  errors: CsvError[];
  duplicates: { row: number; dedupeKey: string }[];
}

function parseRow(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseCsv(csvText: string): CsvParseResult {
  const items: ParsedItem[] = [];
  const errors: CsvError[] = [];
  const duplicates: { row: number; dedupeKey: string }[] = [];

  if (!csvText || !csvText.trim()) {
    return { items, errors, duplicates };
  }

  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length === 0) {
    return { items, errors, duplicates };
  }

  // Parse header
  const header = parseRow(lines[0]).map((h) => h.toLowerCase().trim());
  const urlIdx = header.indexOf("url");

  if (urlIdx === -1) {
    errors.push({ row: 1, message: "CSV must have a 'url' column" });
    return { items, errors, duplicates };
  }

  const nameIdx = header.indexOf("name");
  const groupIdx = header.indexOf("group");
  const memoIdx = header.indexOf("memo");

  const seenKeys = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseRow(line);
    const rawUrl = fields[urlIdx]?.trim();

    if (!rawUrl) continue;

    const rowNum = i + 1; // 1-indexed, header is row 1

    try {
      const normalized = normalizeUrl(rawUrl);

      if (seenKeys.has(normalized.dedupeKey)) {
        duplicates.push({ row: rowNum, dedupeKey: normalized.dedupeKey });
        continue;
      }
      seenKeys.add(normalized.dedupeKey);

      items.push({
        name: nameIdx >= 0 ? fields[nameIdx]?.trim() || undefined : undefined,
        url: rawUrl,
        normalizedUrl: normalized.url,
        dedupeKey: normalized.dedupeKey,
        productId: normalized.productId,
        itemId: normalized.itemId,
        vendorItemId: normalized.vendorItemId,
        group: groupIdx >= 0 ? fields[groupIdx]?.trim() || undefined : undefined,
        memo: memoIdx >= 0 ? fields[memoIdx]?.trim() || undefined : undefined,
      });
    } catch (err) {
      errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : "Invalid URL",
      });
    }
  }

  return { items, errors, duplicates };
}
