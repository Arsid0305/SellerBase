import { createAdminClient } from '@/shared/lib/supabase/admin';
import { WB_WAREHOUSES } from '@/shared/lib/wb-warehouses';
import { fetchExternalStock } from '@/entities/external-stock';
import type {
  SupplyPlan,
  SupplyPlanInput,
  SupplyPlanPatch,
  SupplyPlanItem,
  SupplyPlanChinaItem,
  SupplyPlanStatus,
  SkuWarehouseStats,
} from './types';

const TABLE_MISSING = '42P01';
const TARGET_DAYS = 30;
const SALES_WINDOW_DAYS = 60;

type PlanDb = {
  id: number;
  name: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function toStatus(v: string | null): SupplyPlanStatus {
  const allowed: SupplyPlanStatus[] = ['draft', 'sent_to_ff', 'sent_to_china', 'received', 'cancelled'];
  return (allowed as string[]).includes(v ?? '') ? (v as SupplyPlanStatus) : 'draft';
}

function mapPlan(r: PlanDb, itemsCount = 0): SupplyPlan {
  return {
    id: r.id,
    name: r.name,
    status: toStatus(r.status),
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    itemsCount,
  };
}

export async function fetchSupplyPlans(): Promise<SupplyPlan[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('supply_plans')
    .select('id, name, status, notes, created_at, updated_at')
    .order('created_at', { ascending: false })
    .range(0, 500);
  if (error) {
    if (error.code === TABLE_MISSING) return [];
    console.error('[fetchSupplyPlans]', error);
    return [];
  }
  const plans = (data ?? []) as PlanDb[];
  if (plans.length === 0) return [];

  const ids = plans.map((p) => p.id);
  const { data: itemsRaw } = await supabase
    .from('supply_plan_items')
    .select('plan_id')
    .in('plan_id', ids);
  const counts = new Map<number, number>();
  for (const r of (itemsRaw ?? []) as { plan_id: number }[]) {
    counts.set(r.plan_id, (counts.get(r.plan_id) ?? 0) + 1);
  }
  return plans.map((p) => mapPlan(p, counts.get(p.id) ?? 0));
}

export async function fetchSupplyPlan(id: number): Promise<SupplyPlan | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('supply_plans')
    .select('id, name, status, notes, created_at, updated_at')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === TABLE_MISSING) return null;
    return null;
  }
  return mapPlan(data as PlanDb);
}

export async function fetchPlanItems(planId: number): Promise<SupplyPlanItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('supply_plan_items')
    .select('id, plan_id, sku_id, warehouse_name, qty')
    .eq('plan_id', planId)
    .range(0, 50000);
  if (error) return [];
  return ((data ?? []) as { id: number; plan_id: number; sku_id: number; warehouse_name: string; qty: number }[]).map((r) => ({
    id: r.id,
    planId: r.plan_id,
    skuId: r.sku_id,
    warehouseName: r.warehouse_name,
    qty: r.qty ?? 0,
  }));
}

export async function fetchPlanChinaItems(planId: number): Promise<SupplyPlanChinaItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('supply_plan_china')
    .select('id, plan_id, sku_id, supplier_id, qty, price_cny')
    .eq('plan_id', planId)
    .range(0, 50000);
  if (error) return [];
  return ((data ?? []) as { id: number; plan_id: number; sku_id: number; supplier_id: number | null; qty: number; price_cny: number | null }[]).map((r) => ({
    id: r.id,
    planId: r.plan_id,
    skuId: r.sku_id,
    supplierId: r.supplier_id,
    qty: r.qty ?? 0,
    priceCny: r.price_cny != null ? Number(r.price_cny) : null,
  }));
}

export async function createPlan(input: SupplyPlanInput): Promise<SupplyPlan | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('supply_plans')
    .insert({
      name: input.name,
      status: input.status ?? 'draft',
      notes: input.notes ?? null,
    })
    .select('id, name, status, notes, created_at, updated_at')
    .single();
  if (error) {
    console.error('[createPlan]', error);
    return null;
  }
  return mapPlan(data as PlanDb);
}

export async function updatePlan(id: number, patch: SupplyPlanPatch): Promise<SupplyPlan | null> {
  const supabase = createAdminClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.notes !== undefined) update.notes = patch.notes;
  const { data, error } = await supabase
    .from('supply_plans')
    .update(update)
    .eq('id', id)
    .select('id, name, status, notes, created_at, updated_at')
    .single();
  if (error) {
    console.error('[updatePlan]', error);
    return null;
  }
  return mapPlan(data as PlanDb);
}

export async function deletePlan(id: number): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('supply_plans').delete().eq('id', id);
  if (error) {
    console.error('[deletePlan]', error);
    return false;
  }
  return true;
}

export async function replacePlanItems(
  planId: number,
  items: { skuId: number; warehouseName: string; qty: number }[],
): Promise<boolean> {
  const supabase = createAdminClient();
  const { error: delErr } = await supabase.from('supply_plan_items').delete().eq('plan_id', planId);
  if (delErr) {
    console.error('[replacePlanItems delete]', delErr);
    return false;
  }
  const rows = items
    .filter((i) => i.qty > 0)
    .map((i) => ({
      plan_id: planId,
      sku_id: i.skuId,
      warehouse_name: i.warehouseName,
      qty: i.qty,
    }));
  if (rows.length === 0) return true;
  const { error } = await supabase.from('supply_plan_items').insert(rows);
  if (error) {
    console.error('[replacePlanItems insert]', error);
    return false;
  }
  return true;
}

export async function replacePlanChinaItems(
  planId: number,
  items: { skuId: number; supplierId: number | null; qty: number; priceCny: number | null }[],
): Promise<boolean> {
  const supabase = createAdminClient();
  const { error: delErr } = await supabase.from('supply_plan_china').delete().eq('plan_id', planId);
  if (delErr) {
    console.error('[replacePlanChinaItems delete]', delErr);
    return false;
  }
  const rows = items
    .filter((i) => i.qty > 0)
    .map((i) => ({
      plan_id: planId,
      sku_id: i.skuId,
      supplier_id: i.supplierId,
      qty: i.qty,
      price_cny: i.priceCny,
    }));
  if (rows.length === 0) return true;
  const { error } = await supabase.from('supply_plan_china').insert(rows);
  if (error) {
    console.error('[replacePlanChinaItems insert]', error);
    return false;
  }
  return true;
}

type FactRow = { nm_id: number | null; warehouse_name: string | null; quantity: number | null };
type StockRow = { nm_id: number | null; warehouse_name: string | null; quantity: number | null };
type SkuRow = {
  id: number;
  my_article: string | null;
  wb_article: number | null;
  barcode: string | null;
  title: string | null;
  is_active: boolean | null;
};

/**
 * Возвращает агрегированную статистику по всем активным SKU.
 * Считает: продажи за 60 дней по складам, текущие остатки WB, остатки home/ff,
 * рекомендация «везти» по каждому складу.
 */
export async function fetchSupplyStats(): Promise<{
  rows: SkuWarehouseStats[];
  warehouses: string[];
}> {
  const supabase = createAdminClient();

  const [skuRes, factRes, stockRes, extStock] = await Promise.all([
    supabase
      .from('sku_catalog')
      .select('id, my_article, wb_article, barcode, title, is_active')
      .eq('is_active', true)
      .order('id', { ascending: true })
      .range(0, 5000),
    supabase
      .from('wb_reports_fact')
      .select('nm_id, warehouse_name, quantity')
      .gte('rr_dt', new Date(Date.now() - SALES_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10))
      .range(0, 200000),
    supabase
      .from('wb_stocks')
      .select('nm_id, warehouse_name, quantity')
      .range(0, 100000),
    fetchExternalStock(),
  ]);

  if (skuRes.error) {
    if (skuRes.error.code === TABLE_MISSING) return { rows: [], warehouses: [...WB_WAREHOUSES] };
    console.error('[fetchSupplyStats sku]', skuRes.error);
    return { rows: [], warehouses: [...WB_WAREHOUSES] };
  }

  const skus = (skuRes.data ?? []) as SkuRow[];
  const facts = (factRes.error ? [] : (factRes.data ?? [])) as FactRow[];
  const stocks = (stockRes.error ? [] : (stockRes.data ?? [])) as StockRow[];

  const whSet = new Set<string>();
  for (const s of stocks) if (s.warehouse_name) whSet.add(s.warehouse_name);
  for (const f of facts) if (f.warehouse_name) whSet.add(f.warehouse_name);
  if (whSet.size === 0) for (const w of WB_WAREHOUSES) whSet.add(w);
  const warehouses = Array.from(whSet).sort();

  const factsByNm = new Map<number, Map<string, number>>();
  for (const f of facts) {
    if (f.nm_id == null || !f.warehouse_name) continue;
    let m = factsByNm.get(f.nm_id);
    if (!m) {
      m = new Map();
      factsByNm.set(f.nm_id, m);
    }
    m.set(f.warehouse_name, (m.get(f.warehouse_name) ?? 0) + (f.quantity ?? 0));
  }
  const stocksByNm = new Map<number, Map<string, number>>();
  for (const s of stocks) {
    if (s.nm_id == null || !s.warehouse_name) continue;
    let m = stocksByNm.get(s.nm_id);
    if (!m) {
      m = new Map();
      stocksByNm.set(s.nm_id, m);
    }
    m.set(s.warehouse_name, (m.get(s.warehouse_name) ?? 0) + (s.quantity ?? 0));
  }
  const extByS = new Map<number, { home: number; ff: number }>();
  for (const e of extStock) {
    const cur = extByS.get(e.skuId) ?? { home: 0, ff: 0 };
    if (e.location === 'home') cur.home = e.quantity;
    else if (e.location === 'ff') cur.ff = e.quantity;
    extByS.set(e.skuId, cur);
  }

  const rows: SkuWarehouseStats[] = skus.map((s) => {
    const nm = s.wb_article;
    const salesM = nm != null ? factsByNm.get(nm) ?? new Map<string, number>() : new Map<string, number>();
    const stocksM = nm != null ? stocksByNm.get(nm) ?? new Map<string, number>() : new Map<string, number>();
    const ext = extByS.get(s.id) ?? { home: 0, ff: 0 };

    const salesByWarehouse: Record<string, number> = {};
    const stocksByWarehouse: Record<string, number> = {};
    let totalSales = 0;
    for (const w of warehouses) {
      const sv = salesM.get(w) ?? 0;
      const st = stocksM.get(w) ?? 0;
      salesByWarehouse[w] = sv;
      stocksByWarehouse[w] = st;
      totalSales += sv;
    }

    const recommendByWarehouse: Record<string, number> = {};
    const externalTotal = ext.home + ext.ff;
    for (const w of warehouses) {
      const sv = salesByWarehouse[w] ?? 0;
      const st = stocksByWarehouse[w] ?? 0;
      const velocity = sv / SALES_WINDOW_DAYS;
      const share = totalSales > 0 ? sv / totalSales : 0;
      const need = velocity * TARGET_DAYS - st - share * externalTotal;
      recommendByWarehouse[w] = need > 0 ? Math.ceil(need) : 0;
    }

    return {
      skuId: s.id,
      myArticle: s.my_article,
      wbArticle: s.wb_article,
      barcode: s.barcode,
      title: s.title,
      salesByWarehouse,
      stocksByWarehouse,
      homeStock: ext.home,
      ffStock: ext.ff,
      recommendByWarehouse,
    };
  });

  return { rows, warehouses };
}

export function buildRecommendation(
  salesByWarehouse: Record<string, number>,
  stocksByWarehouse: Record<string, number>,
  homeStock: number,
  ffStock: number,
): Record<string, number> {
  const warehouses = Object.keys(salesByWarehouse);
  let totalSales = 0;
  for (const w of warehouses) totalSales += salesByWarehouse[w] ?? 0;
  const externalTotal = (homeStock ?? 0) + (ffStock ?? 0);
  const out: Record<string, number> = {};
  for (const w of warehouses) {
    const sv = salesByWarehouse[w] ?? 0;
    const st = stocksByWarehouse[w] ?? 0;
    const velocity = sv / SALES_WINDOW_DAYS;
    const share = totalSales > 0 ? sv / totalSales : 0;
    const need = velocity * TARGET_DAYS - st - share * externalTotal;
    out[w] = need > 0 ? Math.ceil(need) : 0;
  }
  return out;
}
