import { createAdminClient } from '@/shared/lib/supabase/admin';
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
  const { data, error } = await supabase
    .from('wb_reports_fact')
    .select('rr_dt, retail_amount, commission_rub, delivery_rub, penalty')
    .gte('rr_dt', range.from)
    .lte('rr_dt', range.to)
    .range(0, 100_000);
  if (error) {
    console.error('[fetchDailyMarginSeries] error', error);
    return buildEmptyMargin(range);
  }
  type Row = { rr_dt: string; retail_amount: number | null; commission_rub: number | null; delivery_rub: number | null; penalty: number | null };
  const rows = (data ?? []) as Row[];
  const map = new Map<string, { rev: number; exp: number }>();
  for (const r of rows) {
    const day = r.rr_dt;
    const cur = map.get(day) ?? { rev: 0, exp: 0 };
    cur.rev += toNumber(r.retail_amount);
    cur.exp += toNumber(r.commission_rub) + toNumber(r.delivery_rub) + toNumber(r.penalty);
    map.set(day, cur);
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
  const { data, error } = await supabase
    .from('wb_reports_fact')
    .select('rr_dt, retail_amount, commission_rub, delivery_rub, penalty')
    .gte('rr_dt', range.from)
    .lte('rr_dt', range.to)
    .range(0, 100_000);
  if (error) {
    console.error('[fetchDailyRevenue] query error', error);
    return buildEmptyRevenueSeries(range);
  }
  type Row = { rr_dt: string; retail_amount: number | null; commission_rub: number | null; delivery_rub: number | null; penalty: number | null };
  const rows = (data ?? []) as Row[];
  const map = new Map<string, { revenue: number; expenses: number }>();
  for (const r of rows) {
    const day = r.rr_dt;
    const cur = map.get(day) ?? { revenue: 0, expenses: 0 };
    cur.revenue += toNumber(r.retail_amount);
    cur.expenses += toNumber(r.commission_rub) + toNumber(r.delivery_rub) + toNumber(r.penalty);
    map.set(day, cur);
  }
  return buildSeriesFromMap(range, map);
}

function buildEmptyRevenueSeries(range: PeriodRange): DailyRevenuePoint[] {
  return buildSeriesFromMap(range, new Map());
}

function buildSeriesFromMap(
  range: PeriodRange,
  map: Map<string, { revenue: number; expenses: number }>,
): DailyRevenuePoint[] {
  const points: DailyRevenuePoint[] = [];
  const start = new Date(`${range.from}T00:00:00Z`);
  const end = new Date(`${range.to}T00:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    const v = map.get(day) ?? { revenue: 0, expenses: 0 };
    points.push({ date: day, revenue: v.revenue, expenses: v.expenses });
  }
  return points;
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
