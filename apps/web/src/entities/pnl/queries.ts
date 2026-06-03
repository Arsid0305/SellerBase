import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { PnlAggregate, PnlSkuRow, DailyRevenuePoint, PeriodRange } from './types';

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function emptyAggregate(): PnlAggregate {
  return { revenue: 0, mainExpenses: 0, extraExpenses: 0, profit: 0, unitsSold: 0, marginPct: 0 };
}

/** Агрегация P&L за период — выручка / осн. расходы / доп. расходы / прибыль. */
export async function fetchPnlAggregate(range: PeriodRange): Promise<PnlAggregate> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_full_pnl_by_period', {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) {
    console.error('[fetchPnlAggregate] RPC error', error);
    return emptyAggregate();
  }
  const rows = (data ?? []) as PnlSkuRow[];
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

/** Дневная серия выручка/расходы из wb_reports_fact — для графика Сводки. */
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
    return buildEmptySeries(range);
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

function buildEmptySeries(range: PeriodRange): DailyRevenuePoint[] {
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
