import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { PeriodRange } from '@/entities/pnl';

export type SourceRow = {
  warehouse: string;
  region?: string;
  orders: number;
  units: number;
  revenue: number;
  avgCheck: number;
  share: number; // %
};

export type SourcesSummary = {
  totalOrders: number;
  totalRevenue: number;
  avgCheck: number;
  uniqueWarehouses: number;
  topWarehouse: { name: string; revenue: number; share: number };
};

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchSourcesByPeriod(
  range: PeriodRange,
): Promise<{ rows: SourceRow[]; summary: SourcesSummary }> {
  const supabase = createAdminClient();
  // Заменено: .range(0, 200_000) на wb_reports_fact — теперь агрегат в БД через RPC.
  const { data, error } = await supabase.rpc('get_sources_by_period', {
    p_from: range.from,
    p_to: range.to,
  });

  if (error || !data) {
    console.error('[fetchSourcesByPeriod] error', error);
    return { rows: [], summary: emptySummary() };
  }

  type AggRow = { warehouse_name: string; orders: number; units: number | string | null; revenue: number | string | null };
  const aggRows = data as AggRow[];

  const map = new Map<string, { orders: number; units: number; revenue: number }>();
  for (const r of aggRows) {
    if (!r.warehouse_name) continue;
    map.set(r.warehouse_name, {
      orders: toNumber(r.orders),
      units: toNumber(r.units),
      revenue: toNumber(r.revenue),
    });
  }

  const totalRevenue = [...map.values()].reduce((acc, v) => acc + v.revenue, 0);
  const totalOrders = [...map.values()].reduce((acc, v) => acc + v.orders, 0);
  const totalUnits = [...map.values()].reduce((acc, v) => acc + v.units, 0);

  const rows: SourceRow[] = [...map.entries()]
    .map(([warehouse, v]) => ({
      warehouse,
      orders: v.orders,
      units: v.units,
      revenue: Math.round(v.revenue),
      avgCheck: v.orders > 0 ? Math.round(v.revenue / v.orders) : 0,
      share: totalRevenue > 0 ? (v.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const top = rows[0];
  const summary: SourcesSummary = {
    totalOrders,
    totalRevenue: Math.round(totalRevenue),
    avgCheck: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
    uniqueWarehouses: rows.length,
    topWarehouse: top
      ? { name: top.warehouse, revenue: top.revenue, share: Math.round(top.share * 10) / 10 }
      : { name: '—', revenue: 0, share: 0 },
  };
  // also expose totalUnits via Summary for use in cards if needed (not in type)
  void totalUnits;
  return { rows, summary };
}

function emptySummary(): SourcesSummary {
  return {
    totalOrders: 0,
    totalRevenue: 0,
    avgCheck: 0,
    uniqueWarehouses: 0,
    topWarehouse: { name: '—', revenue: 0, share: 0 },
  };
}
