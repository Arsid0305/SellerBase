import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { HourlyPoint, SalesHourlyBucket } from '@/entities/sales-hourly';

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchOrdersHourly(from: Date, to: Date): Promise<HourlyPoint[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_orders_hourly', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) {
    console.error('[fetchOrdersHourly] rpc error', error);
    return [];
  }
  type Row = { hour: string; count: number | null; sum_rub: number | null };
  return ((data ?? []) as Row[]).map((r) => ({
    hour: r.hour,
    count: toNumber(r.count),
    sumRub: toNumber(r.sum_rub),
  }));
}

/**
 * Возвращает 3 серии: сегодня / вчера / неделю назад — каждая за 24 часа от своей точки отсчёта.
 * Используется в WB-style графике на /dashboard (вкладка «Заказы»).
 */
export async function fetchOrdersHourlyComparison(now: Date = new Date()): Promise<{
  today: SalesHourlyBucket;
  yesterday: SalesHourlyBucket;
  weekAgo: SalesHourlyBucket;
}> {
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const startOfWeekAgo = new Date(startOfToday.getTime() - 7 * 86_400_000);
  const endOfWeekAgo = new Date(startOfWeekAgo.getTime() + 86_400_000);

  const [today, yesterday, weekAgo] = await Promise.all([
    fetchOrdersHourly(startOfToday, endOfToday),
    fetchOrdersHourly(startOfYesterday, startOfToday),
    fetchOrdersHourly(startOfWeekAgo, endOfWeekAgo),
  ]);

  const bucket = (label: string, points: HourlyPoint[]): SalesHourlyBucket => ({
    label,
    points,
    totalCount: points.reduce((acc, p) => acc + p.count, 0),
    totalSum: points.reduce((acc, p) => acc + p.sumRub, 0),
  });

  return {
    today: bucket('today', today),
    yesterday: bucket('yesterday', yesterday),
    weekAgo: bucket('week-ago', weekAgo),
  };
}
