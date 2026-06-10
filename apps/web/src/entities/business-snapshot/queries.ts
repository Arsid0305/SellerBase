import { createAdminClient } from '@/shared/lib/supabase/admin';

export type SnapshotGoal = {
  id: number;
  title: string;
  status: string;
  progress: number | null;
  deadline: string | null;
};

export type SnapshotTask = {
  id: number;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
};

export type SnapshotProblem = {
  id: number;
  title: string;
  severity: string;
  status: string;
  detectedAt: string;
};

export type SnapshotTopSku = {
  barcode: string;
  title: string;
  revenue: number;
  orders: number;
};

export type SnapshotAnomaly = {
  barcode: string;
  title: string;
  units: number;
  baseline: number;
  zScore: number;
  direction: 'spike' | 'drop';
};

export type BusinessSnapshot = {
  date: string;
  activeSkus: number;
  revenue30d: number;
  orders30d: number;
  avgCheck: number;
  openGoals: SnapshotGoal[];
  openTasks: SnapshotTask[];
  openProblems: SnapshotProblem[];
  topSkus: SnapshotTopSku[];
  anomalies: SnapshotAnomaly[];
};

const TABLE_MISSING = '42P01';

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

async function fetchActiveSkus(supabase: ReturnType<typeof createAdminClient>, date: string): Promise<number> {
  const snap = await supabase
    .from('sku_snapshots')
    .select('sku_id', { count: 'exact', head: true })
    .eq('snapshot_date', date)
    .eq('is_active', true);
  if (!snap.error && (snap.count ?? 0) > 0) return snap.count ?? 0;

  const fallback = await supabase
    .from('sku_catalog')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .lte('created_at', `${date}T23:59:59Z`);
  if (fallback.error) return 0;
  return fallback.count ?? 0;
}

async function fetchRevenueOrders(
  supabase: ReturnType<typeof createAdminClient>,
  date: string,
): Promise<{ revenue: number; orders: number }> {
  const from = shiftDays(date, -29);
  const { data, error } = await supabase
    .from('wb_reports_fact')
    .select('retail_amount, quantity')
    .gte('rr_dt', from)
    .lte('rr_dt', date)
    .gt('quantity', 0)
    .range(0, 200_000);
  if (error) return { revenue: 0, orders: 0 };
  let revenue = 0;
  let orders = 0;
  for (const row of data ?? []) {
    revenue += toNum((row as { retail_amount: unknown }).retail_amount);
    orders += toNum((row as { quantity: unknown }).quantity);
  }
  return { revenue, orders };
}

async function fetchOpenGoals(
  supabase: ReturnType<typeof createAdminClient>,
  date: string,
): Promise<SnapshotGoal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('id, title, status, progress, deadline, created_at')
    .lte('created_at', `${date}T23:59:59Z`)
    .range(0, 500);
  if (error) return [];
  const out: SnapshotGoal[] = [];
  for (const row of data ?? []) {
    const r = row as {
      id: number;
      title: string | null;
      status: string | null;
      progress: number | string | null;
      deadline: string | null;
    };
    const status = r.status ?? 'open';
    const stillOpen = status !== 'achieved' || (r.deadline != null && r.deadline >= date);
    if (!stillOpen) continue;
    out.push({
      id: r.id,
      title: r.title ?? 'Без названия',
      status,
      progress: r.progress != null ? toNum(r.progress) : null,
      deadline: r.deadline,
    });
  }
  return out;
}

async function fetchOpenTasks(
  supabase: ReturnType<typeof createAdminClient>,
  date: string,
): Promise<SnapshotTask[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, status, priority, due_date, completed_at, created_at')
    .lte('created_at', `${date}T23:59:59Z`)
    .order('created_at', { ascending: false })
    .range(0, 500);
  if (error) return [];
  const out: SnapshotTask[] = [];
  for (const row of data ?? []) {
    const r = row as {
      id: number;
      title: string;
      status: string;
      priority: string;
      due_date: string | null;
      completed_at: string | null;
    };
    if (r.completed_at != null && r.completed_at <= `${date}T23:59:59Z`) continue;
    out.push({
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      dueDate: r.due_date,
    });
  }
  return out;
}

async function fetchOpenProblems(
  supabase: ReturnType<typeof createAdminClient>,
  date: string,
): Promise<SnapshotProblem[]> {
  const { data, error } = await supabase
    .from('problems')
    .select('id, title, severity, status, detected_at, resolved_at')
    .lte('detected_at', `${date}T23:59:59Z`)
    .order('detected_at', { ascending: false })
    .range(0, 500);
  if (error) return [];
  const out: SnapshotProblem[] = [];
  for (const row of data ?? []) {
    const r = row as {
      id: number;
      title: string;
      severity: string;
      status: string;
      detected_at: string;
      resolved_at: string | null;
    };
    if (r.resolved_at != null && r.resolved_at <= `${date}T23:59:59Z`) continue;
    out.push({
      id: r.id,
      title: r.title,
      severity: r.severity,
      status: r.status,
      detectedAt: r.detected_at,
    });
  }
  return out;
}

async function fetchTopSkus(
  supabase: ReturnType<typeof createAdminClient>,
  date: string,
): Promise<SnapshotTopSku[]> {
  const from = shiftDays(date, -29);
  const factsRes = await supabase
    .from('wb_reports_fact')
    .select('nm_id, retail_amount, quantity')
    .gte('rr_dt', from)
    .lte('rr_dt', date)
    .gt('quantity', 0)
    .range(0, 200_000);
  if (factsRes.error) return [];
  const agg = new Map<number, { revenue: number; orders: number }>();
  for (const row of factsRes.data ?? []) {
    const r = row as { nm_id: number | null; retail_amount: unknown; quantity: unknown };
    if (r.nm_id == null) continue;
    const cur = agg.get(r.nm_id) ?? { revenue: 0, orders: 0 };
    cur.revenue += toNum(r.retail_amount);
    cur.orders += toNum(r.quantity);
    agg.set(r.nm_id, cur);
  }
  const top = [...agg.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);
  if (top.length === 0) return [];
  const nmIds = top.map(([id]) => id);
  const catalogRes = await supabase
    .from('sku_catalog')
    .select('wb_article, barcode, title')
    .in('wb_article', nmIds)
    .range(0, 500);
  const meta = new Map<number, { barcode: string; title: string }>();
  for (const c of (catalogRes.data ?? []) as {
    wb_article: number | null;
    barcode: string | null;
    title: string | null;
  }[]) {
    if (c.wb_article != null) {
      meta.set(c.wb_article, { barcode: c.barcode ?? String(c.wb_article), title: c.title ?? '—' });
    }
  }
  return top.map(([nmId, v]) => {
    const m = meta.get(nmId);
    return {
      barcode: m?.barcode ?? String(nmId),
      title: m?.title ?? `SKU #${nmId}`,
      revenue: Math.round(v.revenue),
      orders: Math.round(v.orders),
    };
  });
}

async function fetchAnomaliesForDate(
  supabase: ReturnType<typeof createAdminClient>,
  date: string,
): Promise<SnapshotAnomaly[]> {
  const from = shiftDays(date, -30);
  const [factsRes, catalogRes] = await Promise.all([
    supabase
      .from('wb_reports_fact')
      .select('nm_id, rr_dt, quantity')
      .gte('rr_dt', from)
      .lte('rr_dt', date)
      .range(0, 200_000),
    supabase.from('sku_catalog').select('wb_article, barcode, title').not('wb_article', 'is', null).range(0, 5000),
  ]);
  if (factsRes.error) return [];
  const meta = new Map<number, { barcode: string; title: string }>();
  for (const c of (catalogRes.data ?? []) as {
    wb_article: number | null;
    barcode: string | null;
    title: string | null;
  }[]) {
    if (c.wb_article != null) {
      meta.set(c.wb_article, { barcode: c.barcode ?? String(c.wb_article), title: c.title ?? '—' });
    }
  }
  const bySku = new Map<number, Map<string, number>>();
  for (const row of (factsRes.data ?? []) as { nm_id: number; rr_dt: string; quantity: unknown }[]) {
    const q = toNum(row.quantity);
    if (q <= 0) continue;
    let days = bySku.get(row.nm_id);
    if (!days) {
      days = new Map();
      bySku.set(row.nm_id, days);
    }
    days.set(row.rr_dt, (days.get(row.rr_dt) ?? 0) + q);
  }
  const out: SnapshotAnomaly[] = [];
  for (const [nmId, days] of bySku) {
    const targetUnits = days.get(date) ?? 0;
    const values: number[] = [];
    for (const [d, u] of days) {
      if (d !== date) values.push(u);
    }
    if (values.length < 7) continue;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);
    if (std < 0.5 || mean < 1) continue;
    const z = (targetUnits - mean) / std;
    if (Math.abs(z) < 2) continue;
    const info = meta.get(nmId);
    if (!info) continue;
    out.push({
      barcode: info.barcode,
      title: info.title,
      units: targetUnits,
      baseline: Math.round(mean * 10) / 10,
      zScore: Math.round(z * 10) / 10,
      direction: z > 0 ? 'spike' : 'drop',
    });
  }
  out.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  return out.slice(0, 10);
}

export async function fetchBusinessSnapshot(date: string): Promise<BusinessSnapshot> {
  const supabase = createAdminClient();
  const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== TABLE_MISSING) console.error('[fetchBusinessSnapshot]', err);
      return fallback;
    }
  };

  const [activeSkus, revenue, openGoals, openTasks, openProblems, topSkus, anomalies] = await Promise.all([
    safe(fetchActiveSkus(supabase, date), 0),
    safe(fetchRevenueOrders(supabase, date), { revenue: 0, orders: 0 }),
    safe(fetchOpenGoals(supabase, date), [] as SnapshotGoal[]),
    safe(fetchOpenTasks(supabase, date), [] as SnapshotTask[]),
    safe(fetchOpenProblems(supabase, date), [] as SnapshotProblem[]),
    safe(fetchTopSkus(supabase, date), [] as SnapshotTopSku[]),
    safe(fetchAnomaliesForDate(supabase, date), [] as SnapshotAnomaly[]),
  ]);

  const avgCheck = revenue.orders > 0 ? revenue.revenue / revenue.orders : 0;
  return {
    date,
    activeSkus,
    revenue30d: Math.round(revenue.revenue),
    orders30d: Math.round(revenue.orders),
    avgCheck: Math.round(avgCheck),
    openGoals,
    openTasks,
    openProblems,
    topSkus,
    anomalies,
  };
}
