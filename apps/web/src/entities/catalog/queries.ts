import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { CatalogProduct } from '@/features/catalog/types';
import type { ProductLifecycleState } from '@/entities/product-state/types';

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type CatalogDb = {
  id: number;
  my_article: string | null;
  wb_article: number | null;
  barcode: string | null;
  title: string | null;
  category: string | null;
  brand: string | null;
  cost_price_rub: number | null;
  is_active: boolean | null;
};

type FactRow = {
  nm_id: number | null;
  rr_dt: string;
  retail_amount: number | null;
  quantity: number | null;
  ppvz_for_pay: number | null;
  commission_rub: number | null;
  delivery_rub: number | null;
  penalty: number | null;
};

type StockRow = {
  nm_id: number | null;
  warehouse_name: string | null;
  quantity: number | null;
  in_way_to_client: number | null;
};

type SupplyRow = {
  sku_id: number;
  days_to_oos_total: number | null;
  units_per_day: number | null;
};

type LifecycleRow = {
  sku_id: number;
  lifecycle: string | null;
};

const LIFECYCLE_VALUES: readonly ProductLifecycleState[] = [
  'NEW',
  'GROWING',
  'STABLE',
  'DECLINING',
  'CRITICAL',
  'LEADER',
  'ARCHIVED',
];

function toLifecycle(v: string | null): ProductLifecycleState {
  return (LIFECYCLE_VALUES as readonly string[]).includes(v ?? '')
    ? (v as ProductLifecycleState)
    : 'STABLE';
}

export async function fetchCategories(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sku_catalog')
    .select('category')
    .eq('is_active', true)
    .not('category', 'is', null)
    .range(0, 5000);
  if (error) {
    console.error('[fetchCategories]', error);
    return [];
  }
  const set = new Set<string>();
  for (const r of (data ?? []) as { category: string | null }[]) {
    if (r.category && r.category.trim().length > 0) set.add(r.category);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
}

export async function fetchCatalog(): Promise<CatalogProduct[]> {
  const supabase = createAdminClient();

  const { data: catalogData, error: e1 } = await supabase
    .from('sku_catalog')
    .select('id, my_article, wb_article, barcode, title, category, brand, cost_price_rub, is_active')
    .eq('is_active', true)
    .order('id', { ascending: true })
    .range(0, 5000);

  if (e1) {
    console.error('[fetchCatalog] catalog error', e1);
    return [];
  }
  const catalog = (catalogData ?? []) as CatalogDb[];
  if (catalog.length === 0) return [];

  const skuIds = catalog.map((c) => c.id).filter((id): id is number => id != null);
  const nmIds = [...new Set(catalog.map((c) => c.wb_article).filter((v): v is number => v != null))];

  const sinceIso = iso(new Date(Date.now() - 30 * 86_400_000));

  const [factsResult, stocksResult, supplyResult, lifecycleResult] = await Promise.all([
    nmIds.length > 0
      ? supabase
          .from('wb_reports_fact')
          .select('nm_id, rr_dt, retail_amount, quantity, ppvz_for_pay, commission_rub, delivery_rub, penalty')
          .in('nm_id', nmIds)
          .gte('rr_dt', sinceIso)
          .range(0, 200_000)
      : Promise.resolve({ data: [], error: null }),
    nmIds.length > 0
      ? supabase
          .from('wb_stocks')
          .select('nm_id, warehouse_name, quantity, in_way_to_client')
          .in('nm_id', nmIds)
          .range(0, 50_000)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('v_supply_recommendation')
      .select('sku_id, days_to_oos_total, units_per_day')
      .in('sku_id', skuIds)
      .range(0, 5000),
    supabase
      .from('v_sku_lifecycle')
      .select('sku_id, lifecycle')
      .in('sku_id', skuIds)
      .range(0, 5000),
  ]);

  const lifecycleMap = new Map<number, ProductLifecycleState>();
  if (lifecycleResult.error) {
    console.error('[fetchCatalog] v_sku_lifecycle error', lifecycleResult.error);
  } else {
    for (const r of (lifecycleResult.data ?? []) as LifecycleRow[]) {
      lifecycleMap.set(r.sku_id, toLifecycle(r.lifecycle));
    }
  }

  type Sales = {
    revenue: number;
    units: number;
    profit: number;
    cost: number;
    daysWithSales: Set<string>;
    sparkline: Map<string, number>;
    lastSaleDate: string | null;
  };
  const salesByNmId = new Map<number, Sales>();
  for (const r of (factsResult.data ?? []) as FactRow[]) {
    if (r.nm_id == null) continue;
    const cur =
      salesByNmId.get(r.nm_id) ??
      ({
        revenue: 0,
        units: 0,
        profit: 0,
        cost: 0,
        daysWithSales: new Set<string>(),
        sparkline: new Map<string, number>(),
        lastSaleDate: null,
      } satisfies Sales);
    const revenue = toNumber(r.retail_amount);
    const expenses = toNumber(r.commission_rub) + toNumber(r.delivery_rub) + toNumber(r.penalty);
    cur.revenue += revenue;
    cur.units += toNumber(r.quantity);
    cur.profit += revenue - expenses;
    cur.cost += expenses;
    if (revenue > 0) {
      cur.daysWithSales.add(r.rr_dt);
      const prev = cur.sparkline.get(r.rr_dt) ?? 0;
      cur.sparkline.set(r.rr_dt, prev + revenue);
      if (cur.lastSaleDate == null || r.rr_dt > cur.lastSaleDate) cur.lastSaleDate = r.rr_dt;
    }
    salesByNmId.set(r.nm_id, cur);
  }

  const stocksByNmId = new Map<number, { totalStock: number; inTransit: number; warehousesCount: number }>();
  const warehousesPerNm = new Map<number, Set<string>>();
  for (const s of (stocksResult.data ?? []) as StockRow[]) {
    if (s.nm_id == null) continue;
    const cur = stocksByNmId.get(s.nm_id) ?? { totalStock: 0, inTransit: 0, warehousesCount: 0 };
    cur.totalStock += toNumber(s.quantity);
    cur.inTransit += toNumber(s.in_way_to_client);
    stocksByNmId.set(s.nm_id, cur);
    if (s.warehouse_name) {
      const set = warehousesPerNm.get(s.nm_id) ?? new Set();
      set.add(s.warehouse_name);
      warehousesPerNm.set(s.nm_id, set);
    }
  }
  for (const [nm, set] of warehousesPerNm) {
    const cur = stocksByNmId.get(nm);
    if (cur) cur.warehousesCount = set.size;
  }

  const supplyBySkuId = new Map<number, { daysToOos: number; unitsPerDay: number }>();
  for (const s of (supplyResult.data ?? []) as SupplyRow[]) {
    supplyBySkuId.set(s.sku_id, {
      daysToOos: toNumber(s.days_to_oos_total),
      unitsPerDay: toNumber(s.units_per_day),
    });
  }

  // база дней для sparkline (30 точек)
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const allDates: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayUtc);
    d.setUTCDate(d.getUTCDate() - i);
    allDates.push(iso(d));
  }

  const products: CatalogProduct[] = catalog.map((c) => {
    const sales = c.wb_article != null ? salesByNmId.get(c.wb_article) : undefined;
    const stock = c.wb_article != null ? stocksByNmId.get(c.wb_article) : undefined;
    const supply = supplyBySkuId.get(c.id);

    const revenue = sales?.revenue ?? 0;
    const profit = sales?.profit ?? 0;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    const lastSale = sales?.lastSaleDate ?? null;
    const lastSaleDaysAgo = lastSale
      ? Math.max(
          0,
          Math.floor(
            (todayUtc.getTime() - new Date(`${lastSale}T00:00:00Z`).getTime()) / 86_400_000,
          ),
        )
      : 999;

    const sparkline = allDates.map((d) => Math.round(sales?.sparkline.get(d) ?? 0));

    const visibility = Math.round(((sales?.daysWithSales.size ?? 0) / 30) * 100);
    const dailyUnitsArr = allDates.map((d) => sales?.sparkline.get(d) ?? 0);
    const mean = dailyUnitsArr.reduce((a, b) => a + b, 0) / dailyUnitsArr.length;
    const variance = dailyUnitsArr.reduce((a, b) => a + (b - mean) ** 2, 0) / dailyUnitsArr.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    const trust = Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));
    const value = Math.max(0, Math.min(100, Math.round(margin * 2)));

    return {
      id: String(c.id),
      name: c.title ?? c.my_article ?? 'Без названия',
      barcode: c.barcode ?? '',
      channel: 'WB',
      brand: c.brand ?? '—',
      category: c.category ?? '—',
      tags: [],
      stock: stock?.totalStock ?? 0,
      inTransit: stock?.inTransit ?? 0,
      warehousesCount: stock?.warehousesCount ?? 0,
      sales30dRub: Math.round(revenue),
      sales30dUnits: Math.round(sales?.units ?? 0),
      margin: Math.round(margin * 10) / 10,
      cost: Math.round(toNumber(c.cost_price_rub)),
      price: sales && sales.units > 0 ? Math.round(revenue / sales.units) : 0,
      lastSaleDaysAgo,
      daysOfStock: Math.round(supply?.daysToOos ?? 0),
      salesSparkline: sparkline,
      visibility,
      trust,
      value,
      lifecycle: lifecycleMap.get(c.id) ?? 'STABLE',
    };
  });

  return products;
}
