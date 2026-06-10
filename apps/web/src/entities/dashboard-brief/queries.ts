import { createAdminClient } from '@/shared/lib/supabase/admin';

const TABLE_MISSING = '42P01';

export type CriticalSkuBrief = {
  skuId: number;
  title: string;
  hint: string;
};

export type DashboardBrief = {
  yesterday: { revenue: number; profit: number };
  dayBefore: { revenue: number; profit: number };
  criticalCount: number;
  criticalTop: CriticalSkuBrief[];
  tasksTodayCount: number;
  openProblemsCount: number;
};

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function fetchDashboardBrief(): Promise<DashboardBrief> {
  const supabase = createAdminClient();

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const yesterday = new Date(todayUtc);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dayBefore = new Date(todayUtc);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 2);
  const todayIso = iso(todayUtc);
  const yIso = iso(yesterday);
  const dbIso = iso(dayBefore);

  const [pnlY, pnlDb, lifecycleRes, criticalListRes, tasksRes, problemsRes] = await Promise.all([
    supabase.rpc('get_full_pnl_by_period', { p_from: yIso, p_to: yIso }),
    supabase.rpc('get_full_pnl_by_period', { p_from: dbIso, p_to: dbIso }),
    supabase
      .from('v_sku_lifecycle')
      .select('sku_id, lifecycle')
      .eq('lifecycle', 'CRITICAL')
      .range(0, 1000),
    supabase
      .from('v_sku_lifecycle')
      .select('sku_id, lifecycle')
      .eq('lifecycle', 'CRITICAL')
      .range(0, 3),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('due_date', todayIso)
      .neq('status', 'done'),
    supabase
      .from('problems')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'investigating']),
  ]);

  const sumPnl = (data: unknown): { revenue: number; profit: number } => {
    const rows = (Array.isArray(data) ? data : []) as Array<{
      revenue_rub?: number;
      net_profit_rub?: number;
    }>;
    let revenue = 0;
    let profit = 0;
    for (const r of rows) {
      revenue += toNumber(r.revenue_rub);
      profit += toNumber(r.net_profit_rub);
    }
    return { revenue: Math.round(revenue), profit: Math.round(profit) };
  };

  const yesterdayAgg = pnlY.error ? { revenue: 0, profit: 0 } : sumPnl(pnlY.data);
  const dayBeforeAgg = pnlDb.error ? { revenue: 0, profit: 0 } : sumPnl(pnlDb.data);

  const criticalCount = lifecycleRes.error
    ? 0
    : ((lifecycleRes.data ?? []) as unknown[]).length;

  let criticalTop: CriticalSkuBrief[] = [];
  if (!criticalListRes.error) {
    const topIds = ((criticalListRes.data ?? []) as { sku_id: number }[]).map((r) => r.sku_id);
    if (topIds.length > 0) {
      const { data: cat, error } = await supabase
        .from('sku_catalog')
        .select('id, title, my_article')
        .in('id', topIds);
      if (!error) {
        const meta = new Map<number, { title: string }>();
        for (const c of (cat ?? []) as { id: number; title: string | null; my_article: string | null }[]) {
          meta.set(c.id, { title: c.title ?? c.my_article ?? `SKU ${c.id}` });
        }
        criticalTop = topIds.map((id) => ({
          skuId: id,
          title: meta.get(id)?.title ?? `SKU ${id}`,
          hint: 'критический lifecycle',
        }));
      }
    }
  }

  const tasksTodayCount =
    tasksRes.error && tasksRes.error.code !== TABLE_MISSING ? 0 : tasksRes.count ?? 0;
  const openProblemsCount =
    problemsRes.error && problemsRes.error.code !== TABLE_MISSING ? 0 : problemsRes.count ?? 0;

  return {
    yesterday: yesterdayAgg,
    dayBefore: dayBeforeAgg,
    criticalCount,
    criticalTop,
    tasksTodayCount,
    openProblemsCount,
  };
}
