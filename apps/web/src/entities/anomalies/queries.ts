import { createAdminClient } from '@/shared/lib/supabase/admin';
import { computeAnomalyZScore } from './zscore';

export type Anomaly = {
  barcode: string;
  title: string;
  date: string;
  units: number;
  baseline: number;
  zScore: number;
  direction: 'spike' | 'drop';
};

type FactRow = { nm_id: number; rr_dt: string; quantity: number | null };
type CatalogRow = { wb_article: number | null; barcode: string | null; title: string | null };

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function fetchAnomalies(): Promise<Anomaly[]> {
  const supabase = createAdminClient();
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const since = new Date(todayUtc);
  since.setUTCDate(since.getUTCDate() - 30);

  const [factsRes, catalogRes] = await Promise.all([
    supabase
      .from('wb_reports_fact')
      .select('nm_id, rr_dt, quantity')
      .gte('rr_dt', iso(since))
      .lte('rr_dt', iso(todayUtc))
      .range(0, 100_000),
    supabase
      .from('sku_catalog')
      .select('wb_article, barcode, title')
      .not('wb_article', 'is', null)
      .range(0, 5_000),
  ]);

  const facts = (factsRes.data ?? []) as FactRow[];
  const catalog = (catalogRes.data ?? []) as CatalogRow[];
  const meta = new Map<number, { barcode: string; title: string }>();
  for (const c of catalog) {
    if (c.wb_article != null) {
      meta.set(c.wb_article, { barcode: c.barcode ?? String(c.wb_article), title: c.title ?? '—' });
    }
  }

  const bySku = new Map<number, Map<string, number>>();
  for (const f of facts) {
    const q = toNumber(f.quantity);
    if (q <= 0) continue;
    let days = bySku.get(f.nm_id);
    if (!days) {
      days = new Map();
      bySku.set(f.nm_id, days);
    }
    days.set(f.rr_dt, (days.get(f.rr_dt) ?? 0) + q);
  }

  const yesterdayIso = iso(new Date(todayUtc.getTime() - 86_400_000));
  const anomalies: Anomaly[] = [];

  for (const [nmId, days] of bySku) {
    const todayUnits = days.get(iso(todayUtc)) ?? days.get(yesterdayIso) ?? 0;
    const targetDate = days.has(iso(todayUtc)) ? iso(todayUtc) : yesterdayIso;
    const values: number[] = [];
    for (const [d, u] of days) {
      if (d !== targetDate) values.push(u);
    }
    if (values.length < 7) continue;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);
    if (std < 0.5 || mean < 1) continue;
    const z = computeAnomalyZScore(values, todayUnits);
    if (Math.abs(z) < 2) continue;
    const info = meta.get(nmId);
    if (!info) continue;
    anomalies.push({
      barcode: info.barcode,
      title: info.title,
      date: targetDate,
      units: todayUnits,
      baseline: Math.round(mean * 10) / 10,
      zScore: Math.round(z * 10) / 10,
      direction: z > 0 ? 'spike' : 'drop',
    });
  }

  anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  return anomalies.slice(0, 10);
}
