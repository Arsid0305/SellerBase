import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { SkuWeeklyMetric, WeeklySummaryPoint } from './types';

function n(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export async function fetchWeeklySummary(year: number): Promise<WeeklySummaryPoint[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sku_weekly_metrics')
    .select('week_num, units_sold, revenue_wb, net_profit, turnover_days')
    .eq('year', year)
    .range(0, 100_000);
  if (error) {
    console.error('[fetchWeeklySummary]', error);
    return [];
  }
  type Row = { week_num: number; units_sold: number | null; revenue_wb: number | null; net_profit: number | null; turnover_days: number | null };
  const rows = (data ?? []) as Row[];
  const map = new Map<number, { units: number; rev: number; profit: number; tSum: number; tCount: number }>();
  for (const r of rows) {
    const cur = map.get(r.week_num) ?? { units: 0, rev: 0, profit: 0, tSum: 0, tCount: 0 };
    cur.units += n(r.units_sold);
    cur.rev += n(r.revenue_wb);
    cur.profit += n(r.net_profit);
    if (r.turnover_days != null) {
      cur.tSum += n(r.turnover_days);
      cur.tCount += 1;
    }
    map.set(r.week_num, cur);
  }
  const out: WeeklySummaryPoint[] = [];
  for (let w = 1; w <= 53; w += 1) {
    const v = map.get(w);
    if (!v) continue;
    out.push({
      week_num: w,
      units_sold: v.units,
      revenue: v.rev,
      profit: v.profit,
      margin_pct: v.rev > 0 ? (v.profit / v.rev) * 100 : 0,
      turnover_days_avg: v.tCount > 0 ? v.tSum / v.tCount : 0,
    });
  }
  return out;
}

export async function fetchWeeklyBySku(skuId: number, year: number): Promise<SkuWeeklyMetric[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sku_weekly_metrics')
    .select('*')
    .eq('sku_id', skuId)
    .eq('year', year)
    .order('week_num', { ascending: true });
  if (error) {
    console.error('[fetchWeeklyBySku]', error);
    return [];
  }
  return (data ?? []) as SkuWeeklyMetric[];
}

export async function fetchAvailableYears(): Promise<number[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sku_weekly_metrics')
    .select('year')
    .range(0, 10_000);
  if (error || !data) return [2026];
  const set = new Set<number>();
  for (const r of data as { year: number }[]) set.add(r.year);
  const years = Array.from(set).sort((a, b) => b - a);
  return years.length > 0 ? years : [2026];
}
