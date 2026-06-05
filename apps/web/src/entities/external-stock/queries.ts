import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { ExternalStock, ExternalStockLocation } from './types';

const TABLE_MISSING = '42P01';

type Db = {
  id: number;
  sku_id: number;
  location: string;
  quantity: number;
  updated_at: string;
};

function map(r: Db): ExternalStock {
  return {
    id: r.id,
    skuId: r.sku_id,
    location: (r.location === 'ff' ? 'ff' : 'home') as ExternalStockLocation,
    quantity: r.quantity ?? 0,
    updatedAt: r.updated_at,
  };
}

export async function fetchExternalStock(): Promise<ExternalStock[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('external_stock')
    .select('id, sku_id, location, quantity, updated_at')
    .range(0, 20000);
  if (error) {
    if (error.code === TABLE_MISSING) return [];
    console.error('[fetchExternalStock]', error);
    return [];
  }
  return (data ?? []).map((r: Db) => map(r));
}

export async function fetchExternalStockBySku(skuId: number): Promise<{ home: number; ff: number }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('external_stock')
    .select('location, quantity')
    .eq('sku_id', skuId);
  if (error) {
    return { home: 0, ff: 0 };
  }
  const result = { home: 0, ff: 0 };
  for (const r of (data ?? []) as { location: string; quantity: number }[]) {
    if (r.location === 'home') result.home = r.quantity ?? 0;
    else if (r.location === 'ff') result.ff = r.quantity ?? 0;
  }
  return result;
}

export async function upsertExternalStock(
  skuId: number,
  location: ExternalStockLocation,
  quantity: number,
): Promise<ExternalStock | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('external_stock')
    .upsert(
      {
        sku_id: skuId,
        location,
        quantity: Math.max(0, Math.floor(quantity)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'sku_id,location' },
    )
    .select('id, sku_id, location, quantity, updated_at')
    .single();
  if (error) {
    console.error('[upsertExternalStock]', error);
    return null;
  }
  return map(data as Db);
}
