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
  const { data, error } = await supabase
    .from('wb_reports_fact')
    .select('warehouse_name, quantity, retail_amount')
    .gte('rr_dt', range.from)
    .lte('rr_dt', range.to)
    .not('warehouse_name', 'is', null)
    .range(0, 200_000);

  if (error || !data) {
    console.error('[fetchSourcesByPeriod] error', error);
    return { rows: [], summary: emptySummary() };
  }

  type Row = { warehouse_name: string | null; quantity: number | null; retail_amount: number | null };
  const facts = data as Row[];

  const map = new Map<string, { orders: number; units: number; revenue: number }>();
  for (const f of facts) {
    if (!f.warehouse_name) continue;
    const q = toNumber(f.quantity);
    if (q <= 0) continue; // игнорируем возвраты
    const cur = map.get(f.warehouse_name) ?? { orders: 0, units: 0, revenue: 0 };
    cur.orders += 1;
    cur.units += q;
    cur.revenue += toNumber(f.retail_amount);
    map.set(f.warehouse_name, cur);
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
