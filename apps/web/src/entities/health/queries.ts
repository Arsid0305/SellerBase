import { createAdminClient } from '@/shared/lib/supabase/admin';

export type HealthData = {
  lastStocksFetch: string | null;
  lastReportDate: string | null;
  reportRowsLast7d: number;
  activeSkus: number;
  skusWithoutCost: number;
  snapshotsToday: number;
  activeGoals: number;
  openTasks: number;
  factsByDay: { date: string; rows: number }[];
  serverTime: string;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function safeCount(
  supabase: ReturnType<typeof createAdminClient>,
  table: string,
  build: (q: ReturnType<ReturnType<typeof createAdminClient>['from']>) => unknown,
): Promise<number> {
  try {
    const q = supabase.from(table).select('*', { count: 'exact', head: true });
    const res = (await (build(q) as Promise<{ count: number | null; error: unknown }>)) ?? {
      count: 0,
      error: null,
    };
    if (res.error) return 0;
    return res.count ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchHealthData(): Promise<HealthData> {
  const supabase = createAdminClient();
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const sevenDaysAgo = new Date(todayUtc);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
  const sevenDaysAgoIso = isoDate(sevenDaysAgo);
  const todayIso = isoDate(todayUtc);

  const [
    lastStocksRes,
    lastReportRes,
    reportRowsLast7dRes,
    activeSkusRes,
    skusWithoutCostRes,
    snapshotsTodayRes,
    activeGoalsRes,
    openTasksRes,
    factsByDayRes,
  ] = await Promise.all([
    supabase.from('wb_stocks').select('fetched_at').order('fetched_at', { ascending: false }).limit(1),
    supabase.from('wb_reports_fact').select('rr_dt').order('rr_dt', { ascending: false }).limit(1),
    supabase
      .from('wb_reports_fact')
      .select('*', { count: 'exact', head: true })
      .gte('rr_dt', sevenDaysAgoIso),
    supabase.from('sku_catalog').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase
      .from('sku_catalog')
      .select('*', { count: 'exact', head: true })
      .or('cost_price_rub.is.null,cost_price_rub.eq.0'),
    supabase
      .from('sku_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('snapshot_date', todayIso),
    safeCount(supabase, 'goals', (q) => (q as { eq: (c: string, v: string) => unknown }).eq('status', 'active')),
    safeCount(supabase, 'tasks', (q) =>
      (q as { not: (c: string, op: string, v: string) => unknown }).not('status', 'in', '(done,cancelled)'),
    ),
    supabase
      .from('wb_reports_fact')
      .select('rr_dt')
      .gte('rr_dt', sevenDaysAgoIso)
      .lte('rr_dt', todayIso),
  ]);

  const lastStocksFetch = (lastStocksRes.data?.[0] as { fetched_at?: string } | undefined)?.fetched_at ?? null;
  const lastReportDate = (lastReportRes.data?.[0] as { rr_dt?: string } | undefined)?.rr_dt ?? null;
  const reportRowsLast7d = reportRowsLast7dRes.error ? 0 : reportRowsLast7dRes.count ?? 0;
  const activeSkus = activeSkusRes.error ? 0 : activeSkusRes.count ?? 0;
  const skusWithoutCost = skusWithoutCostRes.error ? 0 : skusWithoutCostRes.count ?? 0;
  const snapshotsToday = snapshotsTodayRes.error ? 0 : snapshotsTodayRes.count ?? 0;
  const activeGoals =
    typeof activeGoalsRes === 'number'
      ? activeGoalsRes
      : ((activeGoalsRes as { count?: number } | null)?.count ?? 0);
  const openTasks =
    typeof openTasksRes === 'number'
      ? openTasksRes
      : ((openTasksRes as { count?: number } | null)?.count ?? 0);

  const byDay = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setUTCDate(d.getUTCDate() + i);
    byDay.set(isoDate(d), 0);
  }
  if (!factsByDayRes.error && factsByDayRes.data) {
    for (const r of factsByDayRes.data as { rr_dt: string }[]) {
      const k = (r.rr_dt ?? '').slice(0, 10);
      if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + 1);
    }
  }
  const factsByDay = Array.from(byDay.entries())
    .map(([date, rows]) => ({ date, rows }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    lastStocksFetch,
    lastReportDate,
    reportRowsLast7d,
    activeSkus,
    skusWithoutCost,
    snapshotsToday,
    activeGoals: typeof activeGoals === 'number' ? activeGoals : 0,
    openTasks: typeof openTasks === 'number' ? openTasks : 0,
    factsByDay,
    serverTime: new Date().toISOString(),
  };
}
