import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { CatalogProduct } from '@/features/catalog/types';
import { classifyLifecycle, type ProductLifecycleState } from '@/entities/product-state';

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
  created_at: string | null;
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

export async function fetchCatalog(): Promise<CatalogProduct[]> {
  const supabase = createAdminClient();

  const { data: catalogData, error: e1 } = await supabase
    .from('sku_catalog')
    .select('id, my_article, wb_article, barcode, title, category, brand, cost_price_rub, is_active, created_at')
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

  const [factsResult, stocksResult, supplyResult] = await Promise.all([
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
  ]);

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

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const allDates: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayUtc);
    d.setUTCDate(d.getUTCDate() - i);
    allDates.push(iso(d));
  }
  const first14 = allDates.slice(0, 14);
  const last14 = allDates.slice(16, 30);

  // First pass: build products without lifecycle, sort by revenue, mark top 20% as isTopRevenue
  type Prelim = {
    catalogRow: CatalogDb;
    revenue: number;
    revenue14d: number;
    revenue14dPrev: number;
    units: number;
    margin: number;
    cost: number;
    price: number;
    lastSaleDate: string | null;
    stock: number;
    inTransit: number;
    warehousesCount: number;
    daysOfStock: number;
    sparkline: number[];
    daysInCatalog: number;
    daysSinceLastSale: number;
    unitsPerDay: number;
  };

  const prelim: Prelim[] = catalog.map((c) => {
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
    const revenue14d = last14.reduce((acc, d) => acc + Math.round(sales?.sparkline.get(d) ?? 0), 0);
    const revenue14dPrev = first14.reduce((acc, d) => acc + Math.round(sales?.sparkline.get(d) ?? 0), 0);

    const daysInCatalog = c.created_at
      ? Math.max(
          0,
          Math.floor((todayUtc.getTime() - new Date(c.created_at).getTime()) / 86_400_000),
        )
      : 999;

    return {
      catalogRow: c,
      revenue,
      revenue14d,
      revenue14dPrev,
      units: sales?.units ?? 0,
      margin,
      cost: toNumber(c.cost_price_rub),
      price: sales && sales.units > 0 ? revenue / sales.units : 0,
      lastSaleDate: lastSale,
      stock: stock?.totalStock ?? 0,
      inTransit: stock?.inTransit ?? 0,
      warehousesCount: stock?.warehousesCount ?? 0,
      daysOfStock: supply?.daysToOos ?? 0,
      sparkline,
      daysInCatalog,
      daysSinceLastSale: lastSaleDaysAgo,
      unitsPerDay: supply?.unitsPerDay ?? 0,
    };
  });

  // Определяем top-20% по выручке
  const sortedByRevenue = [...prelim].sort((a, b) => b.revenue - a.revenue);
  const topN = Math.max(1, Math.ceil(sortedByRevenue.length * 0.2));
  const topIds = new Set(sortedByRevenue.slice(0, topN).map((p) => p.catalogRow.id));

  const products: CatalogProduct[] = prelim.map((p) => {
    const lifecycle: ProductLifecycleState = classifyLifecycle({
      isActive: p.catalogRow.is_active !== false,
      daysInCatalog: p.daysInCatalog,
      daysSinceLastSale: p.daysSinceLastSale,
      revenue14d: p.revenue14d,
      revenue14dPrev: p.revenue14dPrev,
      marginPct: p.margin,
      stock: p.stock,
      unitsPerDay: p.unitsPerDay,
      isTopRevenue: topIds.has(p.catalogRow.id),
    });

    return {
      id: String(p.catalogRow.id),
      name: p.catalogRow.title ?? p.catalogRow.my_article ?? 'Без названия',
      barcode: p.catalogRow.barcode ?? '',
      channel: 'WB',
      brand: p.catalogRow.brand ?? '—',
      category: p.catalogRow.category ?? '—',
      tags: [],
      stock: p.stock,
      inTransit: p.inTransit,
      warehousesCount: p.warehousesCount,
      sales30dRub: Math.round(p.revenue),
      sales30dUnits: Math.round(p.units),
      margin: Math.round(p.margin * 10) / 10,
      cost: Math.round(p.cost),
      price: Math.round(p.price),
      lastSaleDaysAgo: p.daysSinceLastSale,
      daysOfStock: Math.round(p.daysOfStock),
      salesSparkline: p.sparkline,
      lifecycle,
    };
  });

  return products;
}
