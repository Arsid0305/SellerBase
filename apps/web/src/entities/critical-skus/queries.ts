import { createAdminClient } from '@/shared/lib/supabase/admin';

export type CriticalReason = 'out_of_stock_selling' | 'no_sales_14d' | 'other';

export type CriticalSku = {
  skuId: number;
  myArticle: string | null;
  wbArticle: number | null;
  title: string;
  photoUrl: string | null;
  stock: number;
  unitsPerDay: number;
  daysSinceLastSale: number | null;
  daysInCatalog: number;
  reason: CriticalReason;
};

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function classifyReason(stock: number, unitsPerDay: number, daysSinceLastSale: number | null): CriticalReason {
  if (stock === 0 && unitsPerDay > 0) return 'out_of_stock_selling';
  if (stock > 0 && (daysSinceLastSale ?? 999) > 14) return 'no_sales_14d';
  return 'other';
}

export async function fetchCriticalSkus(): Promise<CriticalSku[]> {
  const supabase = createAdminClient();

  const { data: lifecycle, error } = await supabase
    .from('v_sku_lifecycle')
    .select('sku_id, stock, units_per_day, days_since_last_sale, days_in_catalog')
    .eq('lifecycle', 'CRITICAL');
  if (error || !lifecycle) return [];

  const ids = (lifecycle as { sku_id: number }[]).map((r) => r.sku_id);
  if (ids.length === 0) return [];

  const { data: catalog } = await supabase
    .from('sku_catalog')
    .select('id, my_article, wb_article, title, photo_url')
    .in('id', ids);

  const meta = new Map<number, { my_article: string | null; wb_article: number | null; title: string; photo_url: string | null }>();
  for (const c of (catalog ?? []) as { id: number; my_article: string | null; wb_article: number | null; title: string | null; photo_url: string | null }[]) {
    meta.set(c.id, {
      my_article: c.my_article,
      wb_article: c.wb_article,
      title: c.title ?? c.my_article ?? `SKU ${c.id}`,
      photo_url: c.photo_url,
    });
  }

  return (lifecycle as Array<{ sku_id: number; stock: number | null; units_per_day: number | string | null; days_since_last_sale: number | null; days_in_catalog: number | null }>)
    .map((r) => {
      const stock = toNumber(r.stock);
      const unitsPerDay = toNumber(r.units_per_day);
      const daysSinceLastSale = r.days_since_last_sale;
      const m = meta.get(r.sku_id);
      return {
        skuId: r.sku_id,
        myArticle: m?.my_article ?? null,
        wbArticle: m?.wb_article ?? null,
        title: m?.title ?? `SKU ${r.sku_id}`,
        photoUrl: m?.photo_url ?? null,
        stock,
        unitsPerDay,
        daysSinceLastSale,
        daysInCatalog: r.days_in_catalog ?? 0,
        reason: classifyReason(stock, unitsPerDay, daysSinceLastSale),
      };
    })
    .sort((a, b) => {
      const order: Record<CriticalReason, number> = { out_of_stock_selling: 0, no_sales_14d: 1, other: 2 };
      if (order[a.reason] !== order[b.reason]) return order[a.reason] - order[b.reason];
      return b.unitsPerDay - a.unitsPerDay;
    });
}
