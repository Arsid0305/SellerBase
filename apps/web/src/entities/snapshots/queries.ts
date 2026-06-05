import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { SnapshotDiff } from './types';

type DiffRow = {
  sku_id: number;
  snapshot_date: string;
  title: string | null;
  brand: string | null;
  price_rub: number | string | null;
  rating: number | string | null;
  reviews_count: number | null;
  is_active: boolean | null;
  prev_price_rub: number | string | null;
  prev_rating: number | string | null;
  prev_reviews_count: number | null;
  prev_title: string | null;
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toNum(v: number | string | null): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchSnapshotsBySkuId(skuId: number): Promise<SnapshotDiff[]> {
  if (!Number.isFinite(skuId)) return [];
  const supabase = createAdminClient();
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const since = new Date(todayUtc);
  since.setUTCDate(since.getUTCDate() - 90);

  const res = await supabase
    .from('v_sku_snapshot_diffs')
    .select(
      'sku_id, snapshot_date, title, brand, price_rub, rating, reviews_count, is_active, prev_price_rub, prev_rating, prev_reviews_count, prev_title',
    )
    .eq('sku_id', skuId)
    .gte('snapshot_date', iso(since))
    .lte('snapshot_date', iso(todayUtc))
    .order('snapshot_date', { ascending: false })
    .range(0, 1000);

  if (res.error) return [];
  const rows = (res.data ?? []) as DiffRow[];

  const diffs: SnapshotDiff[] = [];
  for (const r of rows) {
    if (r.prev_title != null && r.prev_title !== r.title) {
      diffs.push({ date: r.snapshot_date, field: 'title', before: r.prev_title, after: r.title });
    }
    const prevPrice = toNum(r.prev_price_rub);
    const curPrice = toNum(r.price_rub);
    if (prevPrice != null && curPrice != null && prevPrice !== curPrice) {
      diffs.push({ date: r.snapshot_date, field: 'price_rub', before: prevPrice, after: curPrice });
    }
    const prevRating = toNum(r.prev_rating);
    const curRating = toNum(r.rating);
    if (prevRating != null && curRating != null && prevRating !== curRating) {
      diffs.push({ date: r.snapshot_date, field: 'rating', before: prevRating, after: curRating });
    }
    if (r.prev_reviews_count != null && r.reviews_count != null && r.prev_reviews_count !== r.reviews_count) {
      diffs.push({
        date: r.snapshot_date,
        field: 'reviews_count',
        before: r.prev_reviews_count,
        after: r.reviews_count,
      });
    }
  }

  diffs.sort((a, b) => b.date.localeCompare(a.date));
  return diffs;
}
