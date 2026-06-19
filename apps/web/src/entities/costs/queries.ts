import { createAdminClient } from '@/shared/lib/supabase/admin';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';

export type CostRow = {
  sku_id: number;
  barcode: string;
  myArticle: string | null;
  wbArticle: number | null;
  title: string;
  photo_url: string | null;
  current_cost: number;
  valid_from: string | null;
};

export type CostHistoryEntry = {
  id: number;
  sku_id: number;
  cost_rub: number;
  valid_from: string;
  valid_to: string | null;
  source: string;
  created_at: string;
};

type SkuRow = {
  id: number;
  wb_article: number | null;
  my_article: string | null;
  barcode: string | null;
  title: string | null;
  cost_price_rub: number | null;
  photo_url: string | null;
};

type HistoryRow = {
  sku_id: number;
  cost_rub: number;
  valid_from: string;
  valid_to: string | null;
};

export async function fetchCostRows(): Promise<CostRow[]> {
  const supabase = createAdminClient();

  const { data: skus, error: skuErr } = await supabase
    .from('sku_catalog')
    .select('id, wb_article, my_article, barcode, title, cost_price_rub, photo_url')
    .eq('is_active', true)
    .order('id', { ascending: true })
    .range(0, 5000);

  if (skuErr) {
    console.error('[fetchCostRows] sku error', skuErr);
    return [];
  }
  const list = (skus ?? []) as SkuRow[];
  if (list.length === 0) return [];

  const ids = list.map((s) => s.id);

  const { data: hist, error: histErr } = await supabase
    .from('sku_cost_history')
    .select('sku_id, cost_rub, valid_from, valid_to')
    .in('sku_id', ids)
    .is('valid_to', null);

  if (histErr) {
    console.warn('[fetchCostRows] history error (may not exist yet)', histErr.message);
  }

  const latestBySku = new Map<number, HistoryRow>();
  for (const h of (hist ?? []) as HistoryRow[]) {
    const cur = latestBySku.get(h.sku_id);
    if (!cur || h.valid_from > cur.valid_from) latestBySku.set(h.sku_id, h);
  }

  return list.map((s) => {
    const h = latestBySku.get(s.id);
    return {
      sku_id: s.id,
      barcode: s.barcode ?? '',
      myArticle: s.my_article ?? null,
      wbArticle: s.wb_article ?? null,
      title: s.title ?? '—',
      photo_url: s.photo_url ?? wbPhotoUrl(s.wb_article),
      current_cost: h ? Number(h.cost_rub) : Number(s.cost_price_rub ?? 0),
      valid_from: h?.valid_from ?? null,
    };
  });
}

export type CargoTariff = {
  cny_rate_rub: number;
  usd_rate_rub: number | null;
  cny_delivery_per_kg: number;
  effective_from: string;
  comment: string | null;
};

export async function fetchCurrentCargoTariff(): Promise<CargoTariff | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('cargo_tariffs')
    .select('cny_rate_rub, usd_rate_rub, cny_delivery_per_kg, effective_from, comment')
    .lte('effective_from', todayIso())
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[fetchCurrentCargoTariff] error (table may not exist yet)', error.message);
    return null;
  }
  return (data as CargoTariff | null) ?? null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchCostHistory(skuId: number): Promise<CostHistoryEntry[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sku_cost_history')
    .select('id, sku_id, cost_rub, valid_from, valid_to, source, created_at')
    .eq('sku_id', skuId)
    .order('valid_from', { ascending: false });
  if (error) {
    console.error('[fetchCostHistory] error', error);
    return [];
  }
  return (data ?? []) as CostHistoryEntry[];
}
