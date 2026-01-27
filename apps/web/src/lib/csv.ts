import { parse } from "csv-parse/sync";

export type CsvRow = {
  name?: string;
  url: string;
  group?: string;
  memo?: string;
};

export function parseCsv(content: string): CsvRow[] {
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as CsvRow[];
  return records
    .map((row) => ({
      name: row.name?.trim(),
      url: row.url?.trim(),
      group: row.group?.trim(),
      memo: row.memo?.trim()
    }))
    .filter((row) => row.url);
}
