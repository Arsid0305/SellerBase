import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { ChinaSupplier, ChinaSupplierInput, ChinaSupplierPatch } from './types';

const TABLE_MISSING = '42P01';

type Db = {
  id: number;
  sku_id: number;
  supplier_name: string;
  link_1688: string;
  price_cny: number | null;
  is_default: boolean;
  notes: string | null;
  created_at: string;
};

function map(r: Db): ChinaSupplier {
  return {
    id: r.id,
    skuId: r.sku_id,
    supplierName: r.supplier_name,
    link1688: r.link_1688,
    priceCny: r.price_cny != null ? Number(r.price_cny) : null,
    isDefault: !!r.is_default,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

export async function fetchSuppliers(): Promise<ChinaSupplier[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sku_china_suppliers')
    .select('id, sku_id, supplier_name, link_1688, price_cny, is_default, notes, created_at')
    .order('sku_id', { ascending: true })
    .range(0, 10000);
  if (error) {
    if (error.code === TABLE_MISSING) return [];
    console.error('[fetchSuppliers]', error);
    return [];
  }
  return (data ?? []).map((r: Db) => map(r));
}

export async function fetchSuppliersBySku(skuId: number): Promise<ChinaSupplier[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sku_china_suppliers')
    .select('id, sku_id, supplier_name, link_1688, price_cny, is_default, notes, created_at')
    .eq('sku_id', skuId)
    .order('is_default', { ascending: false })
    .range(0, 500);
  if (error) {
    if (error.code === TABLE_MISSING) return [];
    console.error('[fetchSuppliersBySku]', error);
    return [];
  }
  return (data ?? []).map((r: Db) => map(r));
}

async function clearDefault(skuId: number, exceptId?: number) {
  const supabase = createAdminClient();
  let q = supabase.from('sku_china_suppliers').update({ is_default: false }).eq('sku_id', skuId);
  if (exceptId != null) q = q.neq('id', exceptId);
  await q;
}

export async function createSupplier(input: ChinaSupplierInput): Promise<ChinaSupplier | null> {
  const supabase = createAdminClient();
  if (input.isDefault) await clearDefault(input.skuId);
  const { data, error } = await supabase
    .from('sku_china_suppliers')
    .insert({
      sku_id: input.skuId,
      supplier_name: input.supplierName,
      link_1688: input.link1688,
      price_cny: input.priceCny ?? null,
      is_default: !!input.isDefault,
      notes: input.notes ?? null,
    })
    .select('id, sku_id, supplier_name, link_1688, price_cny, is_default, notes, created_at')
    .single();
  if (error) {
    console.error('[createSupplier]', error);
    return null;
  }
  return map(data as Db);
}

export async function updateSupplier(id: number, patch: ChinaSupplierPatch): Promise<ChinaSupplier | null> {
  const supabase = createAdminClient();
  const update: Record<string, unknown> = {};
  if (patch.supplierName !== undefined) update.supplier_name = patch.supplierName;
  if (patch.link1688 !== undefined) update.link_1688 = patch.link1688;
  if (patch.priceCny !== undefined) update.price_cny = patch.priceCny;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.isDefault !== undefined) update.is_default = patch.isDefault;

  if (patch.isDefault) {
    const { data: cur } = await supabase
      .from('sku_china_suppliers')
      .select('sku_id')
      .eq('id', id)
      .single();
    if (cur && typeof (cur as { sku_id?: number }).sku_id === 'number') {
      await clearDefault((cur as { sku_id: number }).sku_id, id);
    }
  }

  const { data, error } = await supabase
    .from('sku_china_suppliers')
    .update(update)
    .eq('id', id)
    .select('id, sku_id, supplier_name, link_1688, price_cny, is_default, notes, created_at')
    .single();
  if (error) {
    console.error('[updateSupplier]', error);
    return null;
  }
  return map(data as Db);
}

export async function deleteSupplier(id: number): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('sku_china_suppliers').delete().eq('id', id);
  if (error) {
    console.error('[deleteSupplier]', error);
    return false;
  }
  return true;
}
