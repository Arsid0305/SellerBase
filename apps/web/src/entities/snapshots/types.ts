export type SnapshotField = 'title' | 'brand' | 'price_rub' | 'rating' | 'reviews_count' | 'is_active';

export type SnapshotDiff = {
  date: string;
  field: SnapshotField;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
};
