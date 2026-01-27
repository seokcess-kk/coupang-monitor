interface SnapshotData {
  variantId: string;
  price: number | null;
  checkedAt: Date;
  statusCode: string;
}

interface VariantWithSnapshots {
  id: string;
  optionKey: string;
  snapshots: SnapshotData[];
}

interface ItemWithVariants {
  variants: VariantWithSnapshots[];
}

export interface ItemStats {
  currentLow: number | null;
  lowestVariant: string | null;
  low7d: number | null;
  low30d: number | null;
  lastCheckedAt: Date | null;
  status: string;
}

export function computeCurrentLow(
  snapshots: SnapshotData[]
): { price: number; variantId: string } | null {
  if (snapshots.length === 0) return null;

  // Group by variantId, take latest snapshot per variant
  const latestByVariant = new Map<string, SnapshotData>();
  for (const s of snapshots) {
    const existing = latestByVariant.get(s.variantId);
    if (!existing || s.checkedAt > existing.checkedAt) {
      latestByVariant.set(s.variantId, s);
    }
  }

  let lowest: { price: number; variantId: string } | null = null;
  for (const s of latestByVariant.values()) {
    if (s.price != null && (lowest === null || s.price < lowest.price)) {
      lowest = { price: s.price, variantId: s.variantId };
    }
  }

  return lowest;
}

export function computePeriodLow(
  snapshots: SnapshotData[],
  days: number,
  now: Date = new Date()
): number | null {
  if (snapshots.length === 0) return null;

  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  let lowest: number | null = null;

  for (const s of snapshots) {
    if (s.checkedAt >= cutoff && s.price != null) {
      if (lowest === null || s.price < lowest) {
        lowest = s.price;
      }
    }
  }

  return lowest;
}

export function computeItemStats(
  item: ItemWithVariants,
  now: Date = new Date()
): ItemStats {
  const allSnapshots: SnapshotData[] = [];
  const variantKeyMap = new Map<string, string>();

  for (const variant of item.variants) {
    variantKeyMap.set(variant.id, variant.optionKey);
    for (const s of variant.snapshots) {
      allSnapshots.push(s);
    }
  }

  if (allSnapshots.length === 0) {
    return {
      currentLow: null,
      lowestVariant: null,
      low7d: null,
      low30d: null,
      lastCheckedAt: null,
      status: "UNKNOWN",
    };
  }

  const current = computeCurrentLow(allSnapshots);
  const low7d = computePeriodLow(allSnapshots, 7, now);
  const low30d = computePeriodLow(allSnapshots, 30, now);

  // Find latest checkedAt
  let lastCheckedAt: Date | null = null;
  let latestStatus = "UNKNOWN";
  for (const s of allSnapshots) {
    if (lastCheckedAt === null || s.checkedAt > lastCheckedAt) {
      lastCheckedAt = s.checkedAt;
      latestStatus = s.statusCode;
    }
  }

  return {
    currentLow: current?.price ?? null,
    lowestVariant: current ? (variantKeyMap.get(current.variantId) ?? null) : null,
    low7d,
    low30d,
    lastCheckedAt,
    status: latestStatus,
  };
}
