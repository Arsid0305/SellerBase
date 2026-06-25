import { createAdminClient } from '@/shared/lib/supabase/admin';

const TABLE_MISSING = '42P01';

export type CriticalSkuBrief = {
  skuId: number;
  title: string;
  hint: string;
};

export type DashboardBrief = {
  yesterday: {
    revenue: number;
    profit: number;
    units: number;
    /** Сумма заказов вчера (wb_orders_fact, без отменённых). */
    ordersRevenue: number;
    /** Количество заказов вчера (шт). */
    ordersCount: number;
    date: string;
    /** true → есть полный финотчёт (комиссия+логистика), profit достоверный. false → только продажи. */
    hasFullReport: boolean;
  };
  dayBefore: {
    revenue: number;
    profit: number;
    units: number;
    ordersRevenue: number;
    ordersCount: number;
    date: string;
    hasFullReport: boolean;
  };
  /** Последняя дата с финотчётом (для подсказки "маржа доступна до N"). */
  lastReportDate: string | null;
  /** Последняя дата с продажами (для подсказки "свежие данные до N"). */
  lastSalesDate: string | null;
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
  const todayIso = iso(todayUtc);

  // Окно: последние 14 дней. Собираем два независимых набора дат:
  // 1) последние даты с финотчётом (wb_reports_fact) — для полной маржи
  // 2) последние даты с продажами (wb_sales_fact) — для свежих KPI
  // "Вчера" = последний день, где есть хотя бы один источник (sales > reports).
  const fourteenAgo = new Date(todayUtc);
  fourteenAgo.setUTCDate(fourteenAgo.getUTCDate() - 14);

  const [reportDatesRes, salesDatesRes] = await Promise.all([
    supabase
      .from('wb_reports_fact')
      .select('rr_dt')
      .gte('rr_dt', iso(fourteenAgo))
      .order('rr_dt', { ascending: false })
      .range(0, 5000),
    supabase
      .from('wb_sales_fact')
      .select('sale_dt')
      .gte('sale_dt', iso(fourteenAgo))
      .order('sale_dt', { ascending: false })
      .range(0, 5000),
  ]);

  const reportDates = new Set<string>();
  for (const r of (reportDatesRes.data ?? []) as { rr_dt: string | null }[]) {
    if (r.rr_dt) reportDates.add(r.rr_dt);
  }
  const salesDates = new Set<string>();
  for (const r of (salesDatesRes.data ?? []) as { sale_dt: string | null }[]) {
    if (r.sale_dt) salesDates.add(r.sale_dt);
  }
  const allDates = [...new Set([...reportDates, ...salesDates])].sort((a, b) =>
    a < b ? 1 : a > b ? -1 : 0,
  );
  const lastReportDate =
    [...reportDates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))[0] ?? null;
  const lastSalesDate =
    [...salesDates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))[0] ?? null;

  const yIso = allDates[0] ?? iso(new Date(todayUtc.getTime() - 86400000));
  const dbIso = allDates[1] ?? iso(new Date(todayUtc.getTime() - 2 * 86400000));
  const yHasFull = reportDates.has(yIso);
  const dbHasFull = reportDates.has(dbIso);

  const [pnlY, pnlDb, salesY, salesDb, ordersY, ordersDb, lifecycleRes, criticalListRes, tasksRes, problemsRes] = await Promise.all([
    supabase.rpc('get_full_pnl_by_period', { p_from: yIso, p_to: yIso }),
    supabase.rpc('get_full_pnl_by_period', { p_from: dbIso, p_to: dbIso }),
    supabase.from('v_daily_sales').select('sale_dt, units_sold, units_returned, revenue_rub').eq('sale_dt', yIso).maybeSingle(),
    supabase.from('v_daily_sales').select('sale_dt, units_sold, units_returned, revenue_rub').eq('sale_dt', dbIso).maybeSingle(),
    supabase.from('wb_orders_fact').select('total_price, is_cancel').gte('date', `${yIso}T00:00:00`).lt('date', `${yIso}T23:59:59.999`),
    supabase.from('wb_orders_fact').select('total_price, is_cancel').gte('date', `${dbIso}T00:00:00`).lt('date', `${dbIso}T23:59:59.999`),
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

  type DailySalesDb = {
    sale_dt: string;
    units_sold: number | null;
    units_returned: number | null;
    revenue_rub: number | null;
  };
  const salesForDay = (
    res: { data: DailySalesDb | null } | { data: null },
  ): { revenue: number; units: number } => {
    const r = res?.data ?? null;
    if (!r) return { revenue: 0, units: 0 };
    const units = toNumber(r.units_sold) - toNumber(r.units_returned);
    return { revenue: Math.round(toNumber(r.revenue_rub)), units };
  };

  const ordersFor = (
    res: { data: Array<{ total_price: number | null; is_cancel: boolean | null }> | null } | { data: null },
  ): { revenue: number; count: number } => {
    const rows = (res?.data ?? []) as Array<{ total_price: number | null; is_cancel: boolean | null }>;
    let revenue = 0;
    let count = 0;
    for (const r of rows) {
      if (r.is_cancel) continue;
      revenue += toNumber(r.total_price);
      count += 1;
    }
    return { revenue: Math.round(revenue), count };
  };

  const buildAgg = (
    iso: string,
    hasFull: boolean,
    pnlRes: typeof pnlY,
    salesRes: typeof salesY,
    ordersRes: typeof ordersY,
  ) => {
    const o = ordersFor(ordersRes);
    if (hasFull && !pnlRes.error) {
      const p = sumPnl(pnlRes.data);
      const s = salesForDay(salesRes);
      return {
        revenue: p.revenue || s.revenue,
        profit: p.profit,
        units: s.units,
        ordersRevenue: o.revenue,
        ordersCount: o.count,
        date: iso,
        hasFullReport: true,
      };
    }
    const s = salesForDay(salesRes);
    return {
      revenue: s.revenue,
      profit: 0,
      units: s.units,
      ordersRevenue: o.revenue,
      ordersCount: o.count,
      date: iso,
      hasFullReport: false,
    };
  };

  const yesterdayAgg = buildAgg(yIso, yHasFull, pnlY, salesY, ordersY);
  const dayBeforeAgg = buildAgg(dbIso, dbHasFull, pnlDb, salesDb, ordersDb);

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
          hint: 'требует срочного решения',
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
    lastReportDate,
    lastSalesDate,
    criticalCount,
    criticalTop,
    tasksTodayCount,
    openProblemsCount,
  };
}
