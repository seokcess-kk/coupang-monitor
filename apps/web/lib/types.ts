// Item list row type
export interface ItemRow {
  id: string;
  name: string | null;
  url: string;
  group: string | null;
  memo: string | null;
  currentLow: number | null;
  lowestVariant: string | null;
  low7d: number | null;
  low30d: number | null;
  lastCheckedAt: string | null;
  status: string;
  variantCount: number;
}

// Item detail page types
export interface VariantRow {
  id: string;
  optionKey: string;
  active: boolean;
  currentPrice: number | null;
  currentStatus: string;
  lastCheckedAt: string | null;
  snapshotCount: number;
}

export interface SnapshotRow {
  id: string;
  variantId: string;
  optionKey: string;
  price: number | null;
  statusCode: string;
  checkedAt: string;
}

export interface ItemData {
  id: string;
  name: string | null;
  url: string;
  group: string | null;
  memo: string | null;
  currentLow: number | null;
  lowestVariant: string | null;
  low7d: number | null;
  low30d: number | null;
  lastCheckedAt: string | null;
  status: string;
  variants: VariantRow[];
  snapshots: SnapshotRow[];
}
