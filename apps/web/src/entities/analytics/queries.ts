import { createAdminClient } from '@/shared/lib/supabase/admin';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';
import type {
  AnalyticsRow,
  AnalyticsSummary,
  ProfitabilityCell,
  ProfitTier,
  SalesTier,
  StabilitySegment,
  StabilityTier,
} from '@/features/analytics/types';
import type { ProductTagKind } from '@/shared/ui/domain/product-tag-badge';
import { classifyProfit, classifySales, classifyStability } from './classifiers';

export { classifyProfit, classifySales, classifyStability };

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
  photo_url: string | null;
};

type PnlDb = {
  sku_id: number;
  revenue_rub: number | null;
  units_sold: number | null;
  margin_pct: number | null;
  net_profit_rub: number | null;
};

type DailyUnitsDb = {
  nm_id: number | null;
  rr_dt: string;
  units: number | string | null;
};

type StockDb = {
  nm_id: number | null;
  quantity: number | null;
};

export async function fetchAnalytics(): Promise<{
  rows: AnalyticsRow[];
  profitabilityMatrix: ProfitabilityCell[];
  stabilitySegments: StabilitySegment[];
  summary: AnalyticsSummary;
}> {
  const supabase = createAdminClient();

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const sinceUtc = new Date(todayUtc);
  sinceUtc.setUTCDate(sinceUtc.getUTCDate() - 29);
  const toIso = iso(todayUtc);
  const fromIso = iso(sinceUtc);

  const [catalogResult, pnlResult, factsResult] = await Promise.all([
    supabase
      .from('sku_catalog')
      .select('id, my_article, wb_article, barcode, title, brand, cost_price_rub, photo_url')
      .eq('is_active', true)
      .range(0, 5000),
    supabase.rpc('get_full_pnl_by_period', { p_from: fromIso, p_to: toIso }),
    // Заменено: .range(0, 200_000) на wb_reports_fact — теперь дневной агрегат через RPC.
    supabase.rpc('get_analytics_daily_units', { p_from: fromIso, p_to: toIso }),
  ]);

  const catalog = (catalogResult.data ?? []) as CatalogDb[];
  if (catalog.length === 0) {
    return { rows: [], profitabilityMatrix: [], stabilitySegments: emptyStability(), summary: emptySummary() };
  }

  const pnlRows = (pnlResult.data ?? []) as PnlDb[];
  const daily = (factsResult.data ?? []) as DailyUnitsDb[];

  const nmIds = [...new Set(catalog.map((c) => c.wb_article).filter((v): v is number => v != null))];
  const stocksResult = nmIds.length > 0
    ? await supabase.from('wb_stocks').select('nm_id, quantity').in('nm_id', nmIds).range(0, 50_000)
    : { data: [] as StockDb[] };
  const stocks = (stocksResult.data ?? []) as StockDb[];

  const pnlBySkuId = new Map<number, PnlDb>();
  for (const p of pnlRows) pnlBySkuId.set(p.sku_id, p);

  const stockByNmId = new Map<number, number>();
  for (const s of stocks) {
    if (s.nm_id == null) continue;
    stockByNmId.set(s.nm_id, (stockByNmId.get(s.nm_id) ?? 0) + toNumber(s.quantity));
  }

  // Массив дней для бэкфилла нулями
  const days: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(sinceUtc);
    d.setUTCDate(d.getUTCDate() + i);
    days.push(iso(d));
  }

  // Продажи по SKU и дню — приходят уже агрегированные RPC.
  const dailyByNm = new Map<number, Map<string, number>>();
  for (const r of daily) {
    if (r.nm_id == null) continue;
    const q = toNumber(r.units);
    if (q <= 0) continue;
    const dayMap = dailyByNm.get(r.nm_id) ?? new Map<string, number>();
    dayMap.set(r.rr_dt, (dayMap.get(r.rr_dt) ?? 0) + q);
    dailyByNm.set(r.nm_id, dayMap);
  }

  const enriched = catalog.map((c) => {
    const pnl = pnlBySkuId.get(c.id);
    const revenue = toNumber(pnl?.revenue_rub);
    const margin = toNumber(pnl?.margin_pct);
    const stock = c.wb_article != null ? (stockByNmId.get(c.wb_article) ?? 0) : 0;
    const unitsSold = toNumber(pnl?.units_sold);

    const dayMap = c.wb_article != null ? dailyByNm.get(c.wb_article) : undefined;
    const dailySeries = dayMap ? days.map((d) => dayMap.get(d) ?? 0) : days.map(() => 0);

    return { catalog: c, revenue, margin, stock, unitsSold, dailySeries };
  });

  const salesTierMap = classifySales(enriched.map((e) => ({ id: e.catalog.id, revenue: e.revenue })));

  const rows: AnalyticsRow[] = enriched.map((e) => {
    const profit = classifyProfit(e.margin);
    const sales = salesTierMap.get(e.catalog.id) ?? 'C';
    const stability = classifyStability(e.dailySeries);
    const tags: ProductTagKind[] = [profit, sales, stability];

    return {
      id: String(e.catalog.id),
      name: e.catalog.title ?? e.catalog.my_article ?? 'Без названия',
      barcode: e.catalog.barcode ?? '',
      photoUrl: e.catalog.photo_url ?? wbPhotoUrl(e.catalog.wb_article),
      channel: 'WB',
      tags,
      profit,
      sales,
      stability,
      revenue: Math.round(e.revenue),
      margin: Math.round(e.margin * 10) / 10,
      cost: Math.round(toNumber(e.catalog.cost_price_rub)),
      stock: e.stock,
      unitsSold: Math.round(e.unitsSold),
    };
  });

  // Матрица прибыльности 4×3
  const matrixCounter = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.profit}_${r.sales}`;
    matrixCounter.set(key, (matrixCounter.get(key) ?? 0) + 1);
  }
  const profitabilityMatrix: ProfitabilityCell[] = [];
  for (const profit of ['PPP', 'PP', 'P', '-P'] as ProfitTier[]) {
    for (const sales of ['A', 'B', 'C'] as SalesTier[]) {
      profitabilityMatrix.push({
        profit,
        sales,
        count: matrixCounter.get(`${profit}_${sales}`) ?? 0,
      });
    }
  }

  // XYZ-сегменты
  const stabilityCounts: Record<StabilityTier, number> = { X: 0, Y: 0, Z: 0 };
  for (const r of rows) stabilityCounts[r.stability] += 1;
  const total = rows.length;
  const stabilitySegments: StabilitySegment[] = [
    {
      tier: 'X',
      label: 'Стабильная',
      count: stabilityCounts.X,
      share: total > 0 ? (stabilityCounts.X / total) * 100 : 0,
      description: 'Коэф. вариации продаж < 10%',
    },
    {
      tier: 'Y',
      label: 'Средняя',
      count: stabilityCounts.Y,
      share: total > 0 ? (stabilityCounts.Y / total) * 100 : 0,
      description: 'Коэф. вариации 10–25%',
    },
    {
      tier: 'Z',
      label: 'Нестабильная',
      count: stabilityCounts.Z,
      share: total > 0 ? (stabilityCounts.Z / total) * 100 : 0,
      description: 'Коэф. вариации > 25% или мало данных',
    },
  ];

  const summary: AnalyticsSummary = {
    totalProducts: total,
    withCost: rows.filter((r) => r.cost > 0).length,
    withoutCost: rows.filter((r) => r.cost <= 0).length,
    withSales: rows.filter((r) => r.revenue > 0).length,
    stable: stabilityCounts.X,
    unstable: stabilityCounts.Z,
  };

  return { rows, profitabilityMatrix, stabilitySegments, summary };
}

function emptyStability(): StabilitySegment[] {
  return [
    { tier: 'X', label: 'Стабильная', count: 0, share: 0, description: 'Коэф. вариации < 10%' },
    { tier: 'Y', label: 'Средняя', count: 0, share: 0, description: 'Коэф. вариации 10–25%' },
    { tier: 'Z', label: 'Нестабильная', count: 0, share: 0, description: 'Коэф. вариации > 25%' },
  ];
}

function emptySummary(): AnalyticsSummary {
  return { totalProducts: 0, withCost: 0, withoutCost: 0, withSales: 0, stable: 0, unstable: 0 };
}
