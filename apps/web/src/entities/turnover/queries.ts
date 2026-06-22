import { createAdminClient } from '@/shared/lib/supabase/admin';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';
import type {
  TurnoverProduct,
  TurnoverSegment,
  TurnoverSegmentKey,
} from '@/features/turnover/types';
import { classifyTurnover } from './classifier';

export { classifyTurnover };

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @deprecated Используй `classifyTurnover` из `./classifier`.
 * Оставлено как локальный алиас для обратной совместимости — будет удалено.
 */
function classify(daysToOos: number, unitsPerDay: number): Exclude<TurnoverSegmentKey, 'all'> {
  return classifyTurnover(daysToOos, unitsPerDay);
}

const SEGMENT_LABEL: Record<TurnoverSegmentKey, string> = {
  all: 'Все',
  stable: 'Стабильная',
  medium: 'Средняя',
  unstable: 'Нестабильная',
};

type TurnoverDb = {
  sku_id: number;
  my_article: string | null;
  wb_article: number | null;
  total_stock: number;
  units_per_day: number;
  days_to_oos_total: number;
};

type CatalogDb = {
  id: number;
  title: string | null;
  barcode: string | null;
  photo_url: string | null;
};

type SalesDb = { nm_id: number | null; retail_amount: number | null; quantity: number | null };

export async function fetchTurnoverData(): Promise<{
  segments: TurnoverSegment[];
  products: TurnoverProduct[];
}> {
  const supabase = createAdminClient();

  const { data: turnover, error: e1 } = await supabase
    .from('v_turnover')
    .select('sku_id, my_article, wb_article, total_stock, units_per_day, days_to_oos_total')
    .range(0, 5000);

  if (e1) {
    console.error('[fetchTurnoverData] v_turnover error', e1);
    return { segments: emptySegments(), products: [] };
  }
  const rows = (turnover ?? []) as TurnoverDb[];
  if (rows.length === 0) return { segments: emptySegments(), products: [] };

  const skuIds = [...new Set(rows.map((r) => r.sku_id).filter((id): id is number => id != null))];
  const nmIds = [...new Set(rows.map((r) => r.wb_article).filter((id): id is number => id != null))];

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const [catalogResult, salesResult] = await Promise.all([
    supabase.from('sku_catalog').select('id, title, barcode, photo_url').in('id', skuIds),
    nmIds.length > 0
      ? supabase
          .from('wb_reports_fact')
          .select('nm_id, retail_amount, quantity')
          .in('nm_id', nmIds)
          .gte('rr_dt', since)
          .range(0, 100_000)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const catalogMap = new Map<number, CatalogDb>();
  for (const c of (catalogResult.data ?? []) as CatalogDb[]) {
    if (c.id != null) catalogMap.set(c.id, c);
  }

  const salesMap = new Map<number, { revenue: number; units: number }>();
  for (const s of (salesResult.data ?? []) as SalesDb[]) {
    if (s.nm_id == null) continue;
    const cur = salesMap.get(s.nm_id) ?? { revenue: 0, units: 0 };
    cur.revenue += toNumber(s.retail_amount);
    cur.units += toNumber(s.quantity);
    salesMap.set(s.nm_id, cur);
  }

  const products: TurnoverProduct[] = rows.map((row) => {
    const cat = catalogMap.get(row.sku_id);
    const sales = row.wb_article != null ? salesMap.get(row.wb_article) : undefined;
    const daysToOos = toNumber(row.days_to_oos_total);
    const unitsPerDay = toNumber(row.units_per_day);
    const segment = classify(daysToOos, unitsPerDay);
    return {
      id: String(row.sku_id),
      name: cat?.title ?? row.my_article ?? 'Без названия',
      barcode: cat?.barcode ?? '',
      myArticle: row.my_article,
      wbArticle: row.wb_article,
      photoUrl: cat?.photo_url ?? wbPhotoUrl(row.wb_article),
      channel: 'WB',
      tags: [],
      segment,
      stockUnits: toNumber(row.total_stock),
      dailySales: Math.round(unitsPerDay * 100) / 100,
      daysOfStock: Math.round(daysToOos),
      revenue: Math.round(sales?.revenue ?? 0),
    };
  });

  const segments = buildSegments(products);
  return { segments, products };
}

function emptySegments(): TurnoverSegment[] {
  return (['all', 'stable', 'medium', 'unstable'] as TurnoverSegmentKey[]).map((key) => ({
    key,
    label: SEGMENT_LABEL[key],
    count: 0,
    share: 0,
    salesUnits: 0,
    salesRevenue: 0,
    stockUnits: 0,
    excessCount: 0,
    outOfStockCount: 0,
  }));
}

function buildSegments(products: TurnoverProduct[]): TurnoverSegment[] {
  const keys: TurnoverSegmentKey[] = ['all', 'stable', 'medium', 'unstable'];
  const total = products.length;

  return keys.map((key) => {
    const filtered =
      key === 'all' ? products : products.filter((p) => p.segment === key);
    const salesRevenue = filtered.reduce((acc, p) => acc + p.revenue, 0);
    const salesUnits = filtered.reduce((acc, p) => acc + Math.round(p.dailySales * 30), 0);
    const stockUnits = filtered.reduce((acc, p) => acc + p.stockUnits, 0);
    const excess = filtered.filter((p) => p.daysOfStock > 180).length;
    const outOfStock = filtered.filter((p) => p.stockUnits === 0).length;
    return {
      key,
      label: SEGMENT_LABEL[key],
      count: filtered.length,
      share: total > 0 ? (filtered.length / total) * 100 : 0,
      salesUnits,
      salesRevenue,
      stockUnits,
      excessCount: excess,
      outOfStockCount: outOfStock,
    };
  });
}
