import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { HourlyPoint, SalesHourlyBucket } from '@/entities/sales-hourly';

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Почасовые точки расходов на рекламу. wb_ads_fact хранит дневную статистику —
 * RPC get_ads_hourly размазывает каждый день в одну часовую точку (00:00 UTC),
 * остальные часы будут нулевыми. count = клики, sum = расход в ₽.
 */
export async function fetchAdsHourly(from: Date, to: Date): Promise<HourlyPoint[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_ads_hourly', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) {
    console.error('[fetchAdsHourly] rpc error', error);
    return [];
  }
  type Row = { hour: string; spend_rub: number | null; clicks: number | null; orders: number | null };
  return ((data ?? []) as Row[]).map((r) => ({
    hour: r.hour,
    count: toNumber(r.clicks),
    sumRub: toNumber(r.spend_rub),
  }));
}

/**
 * Возвращает 3 серии: сегодня / вчера / неделю назад — каждая за 24 часа от своей точки отсчёта.
 * Используется в WB-style графике на /dashboard (вкладка «Продвижение»).
 */
export async function fetchAdsHourlyComparison(now: Date = new Date()): Promise<{
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
    fetchAdsHourly(startOfToday, endOfToday),
    fetchAdsHourly(startOfYesterday, startOfToday),
    fetchAdsHourly(startOfWeekAgo, endOfWeekAgo),
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

/** Сумма расходов на рекламу WB (wb_ads_fact) за период — для P&L. */
export async function fetchMarketingSpend(from: string, to: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_real_marketing_for_period', {
    p_from: from,
    p_to: to,
  });
  if (error) {
    console.error('[fetchMarketingSpend] rpc error', error);
    return 0;
  }
  return toNumber(data);
}
