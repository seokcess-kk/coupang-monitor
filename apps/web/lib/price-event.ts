interface SnapshotInput {
  price: number | null;
  checkedAt: Date;
  statusCode: string;
}

interface PriceEventCandidate {
  period: "7d" | "30d";
  oldPrice: number;
  newPrice: number;
}

interface DetectionInput {
  newPrice: number;
  previousSnapshots: SnapshotInput[];
  now?: Date;
}

function computeMinPrice(
  snapshots: SnapshotInput[],
  days: number,
  now: Date
): number | null {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  let min: number | null = null;

  for (const s of snapshots) {
    if (s.price != null && s.checkedAt >= cutoff) {
      if (min === null || s.price < min) {
        min = s.price;
      }
    }
  }

  return min;
}

export function shouldCreatePriceEvent(input: DetectionInput): PriceEventCandidate[] {
  const { newPrice, previousSnapshots, now = new Date() } = input;
  const events: PriceEventCandidate[] = [];

  if (previousSnapshots.length === 0) return events;

  const low7d = computeMinPrice(previousSnapshots, 7, now);
  const low30d = computeMinPrice(previousSnapshots, 30, now);

  if (low7d !== null && newPrice < low7d) {
    events.push({ period: "7d", oldPrice: low7d, newPrice });
  }

  if (low30d !== null && newPrice < low30d) {
    events.push({ period: "30d", oldPrice: low30d, newPrice });
  }

  return events;
}
