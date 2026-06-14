import { createAdminClient } from '@/shared/lib/supabase/admin';

export type DailySalesPoint = {
  date: string;
  unitsSold: number;
  unitsReturned: number;
  revenueRub: number;
  payoutRub: number;
};

type DailySalesDb = {
  sale_dt: string;
  units_sold: number | null;
  units_returned: number | null;
  revenue_rub: number | null;
  payout_rub: number | null;
};

function num(v: number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Возвращает последнюю дату с фактами продаж в wb_sales_fact. */
export async function fetchLatestSalesDate(): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('wb_sales_fact')
    .select('sale_dt')
    .order('sale_dt', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { sale_dt: string }).sale_dt ?? null;
}

/** Возвращает агрегат продаж за конкретный день (или null если данных нет). */
export async function fetchDailySales(date: string): Promise<DailySalesPoint | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('v_daily_sales')
    .select('sale_dt, units_sold, units_returned, revenue_rub, payout_rub')
    .eq('sale_dt', date)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as DailySalesDb;
  return {
    date: r.sale_dt,
    unitsSold: num(r.units_sold),
    unitsReturned: num(r.units_returned),
    revenueRub: num(r.revenue_rub),
    payoutRub: num(r.payout_rub),
  };
}
