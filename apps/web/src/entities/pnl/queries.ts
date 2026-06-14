import { createAdminClient } from '@/shared/lib/supabase/admin';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';
import type { PnlAggregate, PnlSkuRow, DailyRevenuePoint, PeriodRange } from './types';
import type { ExpenseCategory, ProfitMarginPoint } from '@/features/pnl/types';

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function emptyAggregate(): PnlAggregate {
  return { revenue: 0, mainExpenses: 0, extraExpenses: 0, profit: 0, unitsSold: 0, marginPct: 0 };
}

async function fetchFullPnlRows(range: PeriodRange): Promise<PnlSkuRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_full_pnl_by_period', {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) {
    console.error('[fetchFullPnlRows] RPC error', error);
    return [];
  }
  return (data ?? []) as PnlSkuRow[];
}

export async function fetchPnlSkuRows(range: PeriodRange): Promise<PnlSkuRow[]> {
  return fetchFullPnlRows(range);
}

export async function fetchPnlAggregate(range: PeriodRange): Promise<PnlAggregate> {
  const rows = await fetchFullPnlRows(range);
  const totals = rows.reduce<PnlAggregate>((acc, r) => {
    const commission = toNumber(r.commission_rub);
    const logistics = toNumber(r.logistics_rub);
    const cogs = toNumber(r.cogs_rub);
    const marketing = toNumber(r.marketing_rub);
    const tax = toNumber(r.tax_rub);
    acc.revenue += toNumber(r.revenue_rub);
    acc.mainExpenses += commission + logistics + cogs;
    acc.extraExpenses += marketing + tax;
    acc.profit += toNumber(r.net_profit_rub);
    acc.unitsSold += toNumber(r.units_sold);
    return acc;
  }, emptyAggregate());
  totals.marginPct = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  return totals;
}

/** Разбивка расходов по статьям для таблицы P&L. */
export async function fetchPnlBreakdown(
  range: PeriodRange,
  previousRange?: PeriodRange,
): Promise<{ revenue: number; categories: ExpenseCategory[] }> {
  const [rows, prevRows] = await Promise.all([
    fetchFullPnlRows(range),
    previousRange ? fetchFullPnlRows(previousRange) : Promise.resolve([] as PnlSkuRow[]),
  ]);

  const sums = sumByCategory(rows);
  const prevSums = sumByCategory(prevRows);
  const revenue = rows.reduce((acc, r) => acc + toNumber(r.revenue_rub), 0);

  const make = (
    key: string,
    label: string,
    amount: number,
    prev: number,
    group: ExpenseCategory['group'],
  ): ExpenseCategory => ({
    key,
    label,
    amount: Math.round(amount),
    share: revenue > 0 ? (amount / revenue) * 100 : 0,
    delta: Math.round(amount - prev),
    group,
  });

  const categories: ExpenseCategory[] = [
    make('commission', 'Комиссия МП', sums.commission, prevSums.commission, 'mp'),
    make('cost', 'Себестоимость', sums.cogs, prevSums.cogs, 'product'),
    make('logistics', 'Логистика', sums.logistics, prevSums.logistics, 'logistics'),
    make('marketing', 'Маркетинг', sums.marketing, prevSums.marketing, 'marketing'),
    make('tax', 'Налоги', sums.tax, prevSums.tax, 'finance'),
  ];

  return { revenue, categories: categories.filter((c) => c.amount !== 0 || c.delta !== 0) };
}

function sumByCategory(rows: PnlSkuRow[]): {
  commission: number;
  logistics: number;
  cogs: number;
  marketing: number;
  tax: number;
} {
  return rows.reduce(
    (acc, r) => {
      acc.commission += toNumber(r.commission_rub);
      acc.logistics += toNumber(r.logistics_rub);
      acc.cogs += toNumber(r.cogs_rub);
      acc.marketing += toNumber(r.marketing_rub);
      acc.tax += toNumber(r.tax_rub);
      return acc;
    },
    { commission: 0, logistics: 0, cogs: 0, marketing: 0, tax: 0 },
  );
}

/** Дневная серия «операционная маржа» — (revenue - commission - delivery - penalty) / revenue * 100. */
export async function fetchDailyMarginSeries(range: PeriodRange): Promise<ProfitMarginPoint[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_daily_pnl_series', {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) {
    console.error('[fetchDailyMarginSeries] rpc error', error);
    return buildEmptyMargin(range);
  }
  type Row = {
    rr_dt: string;
    revenue_rub: number | null;
    commission_rub: number | null;
    logistics_rub: number | null;
    penalty_rub: number | null;
  };
  const rows = (data ?? []) as Row[];
  const map = new Map<string, { rev: number; exp: number }>();
  for (const r of rows) {
    map.set(r.rr_dt, {
      rev: toNumber(r.revenue_rub),
      exp:
        toNumber(r.commission_rub) +
        toNumber(r.logistics_rub) +
        toNumber(r.penalty_rub),
    });
  }
  return buildMarginFromMap(range, map);
}

function buildEmptyMargin(range: PeriodRange): ProfitMarginPoint[] {
  return buildMarginFromMap(range, new Map());
}

function buildMarginFromMap(
  range: PeriodRange,
  map: Map<string, { rev: number; exp: number }>,
): ProfitMarginPoint[] {
  const out: ProfitMarginPoint[] = [];
  const start = new Date(`${range.from}T00:00:00Z`);
  const end = new Date(`${range.to}T00:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    const v = map.get(day) ?? { rev: 0, exp: 0 };
    const margin = v.rev > 0 ? ((v.rev - v.exp) / v.rev) * 100 : 0;
    out.push({ date: day, margin: Math.round(margin * 10) / 10 });
  }
  return out;
}

export async function fetchDailyRevenue(range: PeriodRange): Promise<DailyRevenuePoint[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_daily_pnl_series', {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) {
    console.error('[fetchDailyRevenue] rpc error', error);
    return buildEmptyRevenueSeries(range);
  }
  type Row = {
    rr_dt: string;
    revenue_rub: number | null;
    commission_rub: number | null;
    logistics_rub: number | null;
    penalty_rub: number | null;
  };
  const rows = (data ?? []) as Row[];
  const map = new Map<string, Parts>();
  for (const r of rows) {
    const commission = toNumber(r.commission_rub);
    const logistics = toNumber(r.logistics_rub);
    const penalty = toNumber(r.penalty_rub);
    map.set(r.rr_dt, {
      revenue: toNumber(r.revenue_rub),
      expenses: commission + logistics + penalty,
      commission,
      logistics,
    });
  }
  return buildSeriesFromMap(range, map);
}

type Parts = { revenue: number; expenses: number; commission: number; logistics: number };

function buildEmptyRevenueSeries(range: PeriodRange): DailyRevenuePoint[] {
  return buildSeriesFromMap(range, new Map());
}

type Granularity = 'day' | 'week' | 'month';

function pickGranularity(days: number): Granularity {
  if (days <= 14) return 'day';
  if (days <= 40) return 'week';
  return 'month';
}

function bucketKey(d: Date, g: Granularity): string {
  if (g === 'month') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
  }
  if (g === 'week') {
    const dow = d.getUTCDay();
    const shift = dow === 0 ? 6 : dow - 1;
    const mon = new Date(d);
    mon.setUTCDate(mon.getUTCDate() - shift);
    return mon.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function buildSeriesFromMap(range: PeriodRange, map: Map<string, Parts>): DailyRevenuePoint[] {
  const start = new Date(`${range.from}T00:00:00Z`);
  const end = new Date(`${range.to}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const g = pickGranularity(days);

  const empty = (): Parts => ({ revenue: 0, expenses: 0, commission: 0, logistics: 0 });
  const buckets = new Map<string, Parts>();
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    const key = bucketKey(d, g);
    const v = map.get(day) ?? empty();
    const cur = buckets.get(key) ?? empty();
    cur.revenue += v.revenue;
    cur.expenses += v.expenses;
    cur.commission += v.commission;
    cur.logistics += v.logistics;
    buckets.set(key, cur);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, v]) => ({ date, revenue: v.revenue, expenses: v.expenses, commission: v.commission, logistics: v.logistics }));
}

export type CategoryPnlRow = {
  category: string;
  revenue: number;
  share: number;
  marginPct: number;
};

export async function fetchPnlByCategory(range: PeriodRange): Promise<CategoryPnlRow[]> {
  const supabase = createAdminClient();
  const [rows, catalogRes] = await Promise.all([
    fetchFullPnlRows(range),
    supabase
      .from('sku_catalog')
      .select('id, subject_name, category')
      .range(0, 5000),
  ]);
  if (rows.length === 0) return [];

  const catById = new Map<number, string>();
  for (const r of (catalogRes.data ?? []) as { id: number; subject_name: string | null; category: string | null }[]) {
    const subj = (r.subject_name ?? '').trim();
    const cat = (r.category ?? '').trim();
    catById.set(r.id, subj || cat || '— без категории');
  }

  const agg = new Map<string, { revenue: number; profit: number }>();
  let total = 0;
  for (const r of rows) {
    const cat = catById.get(r.sku_id) ?? '— без категории';
    const cur = agg.get(cat) ?? { revenue: 0, profit: 0 };
    const rev = toNumber(r.revenue_rub);
    cur.revenue += rev;
    cur.profit += toNumber(r.net_profit_rub);
    agg.set(cat, cur);
    total += rev;
  }

  const out: CategoryPnlRow[] = [];
  for (const [category, v] of agg) {
    out.push({
      category,
      revenue: Math.round(v.revenue),
      share: total > 0 ? Math.round((v.revenue / total) * 1000) / 10 : 0,
      marginPct: v.revenue > 0 ? Math.round((v.profit / v.revenue) * 1000) / 10 : 0,
    });
  }
  out.sort((a, b) => b.revenue - a.revenue);
  return out;
}

export async function fetchPnlSkuTable(range: PeriodRange) {
  const rows = await fetchFullPnlRows(range);
  if (rows.length === 0) return [];
  const supabase = createAdminClient();
  const skuIds = rows.map((r) => r.sku_id);
  const { data: cat } = await supabase
    .from('sku_catalog')
    .select('id, title, my_article, wb_article, photo_url')
    .in('id', skuIds);
  const meta = new Map<number, { title: string; myArticle: string | null; wbArticle: number | null; photoUrl: string | null }>();
  for (const c of (cat ?? []) as { id: number; title: string | null; my_article: string | null; wb_article: number | null; photo_url: string | null }[]) {
    meta.set(c.id, {
      title: c.title ?? c.my_article ?? `SKU ${c.id}`,
      myArticle: c.my_article,
      wbArticle: c.wb_article,
      photoUrl: c.photo_url ?? wbPhotoUrl(c.wb_article),
    });
  }
  return rows.map((r) => {
    const m = meta.get(r.sku_id);
    return {
      skuId: r.sku_id,
      title: m?.title ?? `SKU ${r.sku_id}`,
      myArticle: m?.myArticle ?? r.my_article ?? null,
      wbArticle: m?.wbArticle ?? r.wb_article ?? null,
      photoUrl: m?.photoUrl ?? null,
      unitsSold: Math.round(toNumber(r.units_sold)),
      revenue: Math.round(toNumber(r.revenue_rub)),
      commission: Math.round(toNumber(r.commission_rub)),
      logistics: Math.round(toNumber(r.logistics_rub)),
      cogs: Math.round(toNumber(r.cogs_rub)),
      marketing: Math.round(toNumber(r.marketing_rub)),
      tax: Math.round(toNumber(r.tax_rub)),
      profit: Math.round(toNumber(r.net_profit_rub)),
      marginPct: Math.round(toNumber(r.margin_pct) * 10) / 10,
    };
  });
}

export type TopProductRow = {
  skuId: number;
  title: string;
  myArticle: string | null;
  wbArticle: number | null;
  photoUrl: string | null;
  revenue: number;
  unitsSold: number;
  share: number;
};

export async function fetchTopProductsByRevenue(
  range: PeriodRange,
  limit = 5,
): Promise<TopProductRow[]> {
  const rows = await fetchFullPnlRows(range);
  if (rows.length === 0) return [];
  const supabase = createAdminClient();
  const skuIds = rows.map((r) => r.sku_id);
  const { data: cat } = await supabase
    .from('sku_catalog')
    .select('id, title, my_article, wb_article, photo_url')
    .in('id', skuIds);
  const meta = new Map<number, { title: string; myArticle: string | null; wbArticle: number | null; photoUrl: string | null }>();
  for (const c of (cat ?? []) as { id: number; title: string | null; my_article: string | null; wb_article: number | null; photo_url: string | null }[]) {
    meta.set(c.id, {
      title: c.title ?? c.my_article ?? `SKU ${c.id}`,
      myArticle: c.my_article,
      wbArticle: c.wb_article,
      photoUrl: c.photo_url ?? wbPhotoUrl(c.wb_article),
    });
  }
  const total = rows.reduce((acc, r) => acc + toNumber(r.revenue_rub), 0);
  return rows
    .map((r) => {
      const m = meta.get(r.sku_id);
      return {
        skuId: r.sku_id,
        title: m?.title ?? `SKU ${r.sku_id}`,
        myArticle: m?.myArticle ?? r.my_article ?? null,
        wbArticle: m?.wbArticle ?? r.wb_article ?? null,
        photoUrl: m?.photoUrl ?? null,
        revenue: Math.round(toNumber(r.revenue_rub)),
        unitsSold: Math.round(toNumber(r.units_sold)),
        share: total > 0 ? Math.round((toNumber(r.revenue_rub) / total) * 1000) / 10 : 0,
      };
    })
    .filter((r) => r.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function shiftRangeBack(range: PeriodRange): PeriodRange {
  const from = new Date(`${range.from}T00:00:00Z`);
  const to = new Date(`${range.to}T00:00:00Z`);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const prevTo = new Date(from);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (days - 1));
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

export function lastNDaysRange(days: number, endIso?: string): PeriodRange {
  const end = endIso ? new Date(`${endIso}T00:00:00Z`) : new Date();
  const to = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}
