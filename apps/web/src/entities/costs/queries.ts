import { createAdminClient } from '@/shared/lib/supabase/admin';

export type CostRow = {
  sku_id: number;
  barcode: string;
  title: string;
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
  barcode: string | null;
  title: string | null;
  cost_price_rub: number | null;
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
    .select('id, barcode, title, cost_price_rub')
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
      title: s.title ?? '—',
      current_cost: h ? Number(h.cost_rub) : Number(s.cost_price_rub ?? 0),
      valid_from: h?.valid_from ?? null,
    };
  });
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
