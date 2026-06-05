import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { ProductDetail } from '@/features/product-detail/types';

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
  brand: string | null;
  cost_price_rub: number | null;
  created_at: string | null;
  photo_url: string | null;
  rating: number | null;
  reviews_count: number | null;
  last_content_sync_at: string | null;
};

const CATALOG_COLS =
  'id, my_article, wb_article, barcode, title, brand, cost_price_rub, created_at, photo_url, rating, reviews_count, last_content_sync_at';

type FactDb = {
  rr_dt: string;
  quantity: number | null;
  retail_price: number | null;
  retail_amount: number | null;
  ppvz_for_pay: number | null;
  commission_rub: number | null;
  delivery_rub: number | null;
  penalty: number | null;
};

type StockDb = {
  warehouse_name: string | null;
  quantity: number | null;
  in_way_to_client: number | null;
  in_way_from_client: number | null;
};

type PnlDb = {
  sku_id: number;
  revenue_rub: number | null;
  commission_rub: number | null;
  logistics_rub: number | null;
  cogs_rub: number | null;
  marketing_rub: number | null;
  tax_rub: number | null;
  net_profit_rub: number | null;
  margin_pct: number | null;
  units_sold: number | null;
};

async function findCatalog(barcode: string): Promise<CatalogDb | null> {
  const supabase = createAdminClient();
  const byBarcode = await supabase
    .from('sku_catalog')
    .select(CATALOG_COLS)
    .eq('barcode', barcode)
    .limit(1)
    .maybeSingle();

  if (byBarcode.data) return byBarcode.data as CatalogDb;

  const asId = Number(barcode);
  if (Number.isFinite(asId)) {
    const byId = await supabase
      .from('sku_catalog')
      .select(CATALOG_COLS)
      .eq('id', asId)
      .limit(1)
      .maybeSingle();
    if (byId.data) return byId.data as CatalogDb;
  }
  return null;
}

export async function fetchProductDetailByBarcode(barcode: string): Promise<ProductDetail | null> {
  const supabase = createAdminClient();
  const c = await findCatalog(barcode);
  if (!c) return null;

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const since = new Date(todayUtc);
  since.setUTCDate(since.getUTCDate() - 29);
  const sincePrev = new Date(since);
  sincePrev.setUTCDate(sincePrev.getUTCDate() - 30);
  const fromIso = iso(since);
  const toIso = iso(todayUtc);
  const prevFromIso = iso(sincePrev);
  const prevToIso = iso(new Date(since.getTime() - 86_400_000));

  const [factsResult, stocksResult, pnlResult, pnlPrevResult] = await Promise.all([
    c.wb_article != null
      ? supabase
          .from('wb_reports_fact')
          .select('rr_dt, quantity, retail_price, retail_amount, ppvz_for_pay, commission_rub, delivery_rub, penalty')
          .eq('nm_id', c.wb_article)
          .gte('rr_dt', fromIso)
          .lte('rr_dt', toIso)
          .range(0, 50_000)
      : Promise.resolve({ data: [] as FactDb[], error: null }),
    c.wb_article != null
      ? supabase
          .from('wb_stocks')
          .select('warehouse_name, quantity, in_way_to_client, in_way_from_client')
          .eq('nm_id', c.wb_article)
          .range(0, 1000)
      : Promise.resolve({ data: [] as StockDb[], error: null }),
    supabase.rpc('get_full_pnl_by_period', { p_from: fromIso, p_to: toIso }),
    supabase.rpc('get_full_pnl_by_period', { p_from: prevFromIso, p_to: prevToIso }),
  ]);

  const facts = (factsResult.data ?? []) as FactDb[];
  const stocks = (stocksResult.data ?? []) as StockDb[];
  const pnlRows = (pnlResult.data ?? []) as PnlDb[];
  const pnlPrevRows = (pnlPrevResult.data ?? []) as PnlDb[];

  const pnlCur = pnlRows.find((r) => r.sku_id === c.id);
  const pnlPrev = pnlPrevRows.find((r) => r.sku_id === c.id);

  let orders = 0;
  let units = 0;
  let returnsCount = 0;
  let revenueTotal = 0;
  let commissionTotal = 0;
  let deliveryTotal = 0;
  let penaltyTotal = 0;
  let priceSum = 0;
  let priceN = 0;
  let lastSaleDate: string | null = null;
  const revenueByDay = new Map<string, { revenue: number; orders: number }>();
  for (const f of facts) {
    const q = toNumber(f.quantity);
    const amount = toNumber(f.retail_amount);
    const price = toNumber(f.retail_price);
    commissionTotal += toNumber(f.commission_rub);
    deliveryTotal += toNumber(f.delivery_rub);
    penaltyTotal += toNumber(f.penalty);
    if (q > 0) {
      orders += 1;
      units += q;
      revenueTotal += amount;
      if (price > 0) {
        priceSum += price;
        priceN += 1;
      }
      if (lastSaleDate == null || f.rr_dt > lastSaleDate) lastSaleDate = f.rr_dt;
      const day = revenueByDay.get(f.rr_dt) ?? { revenue: 0, orders: 0 };
      day.revenue += amount;
      day.orders += 1;
      revenueByDay.set(f.rr_dt, day);
    } else if (q < 0) {
      returnsCount += 1;
    }
  }

  const warehouseAgg = new Map<string, { units: number; inTransit: number }>();
  let totalStock = 0;
  let totalInTransit = 0;
  for (const s of stocks) {
    const name = s.warehouse_name ?? '—';
    const cur = warehouseAgg.get(name) ?? { units: 0, inTransit: 0 };
    cur.units += toNumber(s.quantity);
    cur.inTransit += toNumber(s.in_way_to_client) + toNumber(s.in_way_from_client);
    warehouseAgg.set(name, cur);
    totalStock += toNumber(s.quantity);
    totalInTransit += toNumber(s.in_way_to_client) + toNumber(s.in_way_from_client);
  }

  const buyoutRate = orders > 0 ? ((orders - returnsCount) / orders) * 100 : 0;
  const avgPrice = priceN > 0 ? priceSum / priceN : 0;

  const daysSinceLastOrder = lastSaleDate
    ? Math.max(
        0,
        Math.floor((todayUtc.getTime() - new Date(`${lastSaleDate}T00:00:00Z`).getTime()) / 86_400_000),
      )
    : 999;
  const dailySales = units / 30;
  const daysOfStock = dailySales > 0 ? Math.floor(totalStock / dailySales) : 999;

  const days: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    days.push(iso(d));
  }
  const revenueSeries = days.map((d) => {
    const v = revenueByDay.get(d) ?? { revenue: 0, orders: 0 };
    return { date: d, revenue: Math.round(v.revenue), orders: v.orders };
  });
  const stockSeries = days.map((d) => ({ date: d, stock: totalStock, inTransit: totalInTransit }));

  const revenue = toNumber(pnlCur?.revenue_rub) || revenueTotal;
  const cogs = toNumber(pnlCur?.cogs_rub);
  const marketing = toNumber(pnlCur?.marketing_rub);
  const tax = toNumber(pnlCur?.tax_rub);
  const profit = toNumber(pnlCur?.net_profit_rub);
  const expensesTotal = commissionTotal + deliveryTotal + cogs + marketing + tax + penaltyTotal;
  const profitability = revenue > 0 ? (profit / revenue) * 100 : 0;
  const revenuePrev = toNumber(pnlPrev?.revenue_rub);
  const trend = revenuePrev > 0 ? ((revenue - revenuePrev) / revenuePrev) * 100 : 0;
  const lostRevenue = totalStock <= 0 && dailySales > 0 ? Math.round(dailySales * avgPrice * 14) : 0;

  const detail: ProductDetail = {
    id: String(c.id),
    name: c.title ?? c.my_article ?? 'Без названия',
    channel: 'WB',
    tags: [],
    meta: {
      brand: c.brand ?? '—',
      type: c.wb_article != null ? 'Wildberries (FBO/FBS)' : '—',
      supplierCode: c.my_article ?? '—',
      wbCode: String(c.wb_article ?? '—'),
      barcode: c.barcode ?? '',
      inStock: totalStock > 0,
      inStockSince: c.created_at ? formatYmd(c.created_at) : '—',
      rating: c.rating != null ? Number(c.rating) : undefined,
      reviewsCount: c.reviews_count != null ? c.reviews_count : undefined,
    },
    photoUrl: c.photo_url ?? undefined,
    sales: {
      price: Math.round(avgPrice),
      priceWithoutDiscount: 0,
      orders,
      delivered: orders,
      bought: orders - returnsCount,
      returns: returnsCount,
      buyoutRate: Math.round(buyoutRate * 10) / 10,
      daysSinceLastOrder,
      daysOfStock,
      turnoverDays: daysOfStock,
    },
    finance: {
      revenue: Math.round(revenue),
      expenses: Math.round(expensesTotal),
      profit: Math.round(profit),
      profitability: Math.round(profitability * 10) / 10,
      marketingExpenses: Math.round(marketing),
      revenueTrend: Math.round(trend),
      lostRevenue,
    },
    expenses: {
      wbCommission: Math.round(commissionTotal),
      wbLogistics: Math.round(deliveryTotal),
      wbPenalties: Math.round(penaltyTotal),
      acquiring: 0,
      storage: 0,
      cost: Math.round(cogs),
    },
    warehouses: [...warehouseAgg.entries()]
      .sort((a, b) => b[1].units - a[1].units)
      .map(([name, v]) => ({
        name,
        units: v.units,
        inTransit: v.inTransit,
        daysOfStock: dailySales > 0 ? Math.floor(v.units / dailySales) : 0,
      })),
    revenueByDay: revenueSeries,
    stockByDay: stockSeries,
  };

  return detail;
}

function formatYmd(isoStr: string): string {
  const d = new Date(isoStr);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}
