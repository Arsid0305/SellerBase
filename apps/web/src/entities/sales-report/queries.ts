import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { PeriodRange } from '@/entities/pnl';
import type { SalesGrouping, SalesReportRow } from '@/features/sales-report/types';

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type FactRow = {
  rr_dt: string;
  nm_id: number | null;
  sa_name: string | null;
  barcode: string | null;
  quantity: number | null;
  retail_amount: number | null;
};

type Bucket = { orders: number; unitsSold: number; revenue: number; cancellations: number };

function emptyBucket(): Bucket {
  return { orders: 0, unitsSold: 0, revenue: 0, cancellations: 0 };
}

function toRow(key: string, label: string, sublabel: string | undefined, b: Bucket): SalesReportRow {
  const cancelRate = b.orders > 0 ? (b.cancellations / b.orders) * 100 : 0;
  return {
    key,
    label,
    sublabel,
    orders: b.orders,
    unitsSold: b.unitsSold,
    revenue: Math.round(b.revenue),
    avgCheck: b.orders > 0 ? Math.round(b.revenue / b.orders) : 0,
    cancellations: b.cancellations,
    cancelRate: Math.round(cancelRate * 10) / 10,
  };
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function isoWeekKey(d: Date): { key: string; label: string } {
  // ISO week (Mon-based)
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  const key = `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  return { key, label: `Неделя ${week}, ${date.getUTCFullYear()}` };
}

export async function fetchSalesReportAll(
  range: PeriodRange,
): Promise<Record<SalesGrouping, SalesReportRow[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('wb_reports_fact')
    .select('rr_dt, nm_id, sa_name, barcode, quantity, retail_amount')
    .gte('rr_dt', range.from)
    .lte('rr_dt', range.to)
    .range(0, 200_000);

  const empty: Record<SalesGrouping, SalesReportRow[]> = {
    day: [],
    week: [],
    month: [],
    channel: [],
    product: [],
  };
  if (error) {
    console.error('[fetchSalesReportAll] error', error);
    return empty;
  }
  const rows = (data ?? []) as FactRow[];
  if (rows.length === 0) return empty;

  const dayMap = new Map<string, Bucket>();
  const weekMap = new Map<string, { label: string; bucket: Bucket }>();
  const monthMap = new Map<string, { label: string; bucket: Bucket }>();
  const productMap = new Map<string, { label: string; sublabel: string; bucket: Bucket }>();
  const channelBucket: Bucket = emptyBucket();

  for (const r of rows) {
    const qty = toNumber(r.quantity);
    const amount = toNumber(r.retail_amount);
    const isCancellation = qty < 0;

    const addToBucket = (b: Bucket) => {
      if (isCancellation) {
        b.cancellations += 1;
      } else if (qty > 0) {
        b.orders += 1;
        b.unitsSold += qty;
        b.revenue += amount;
      }
    };

    // Day
    const dayBucket = dayMap.get(r.rr_dt) ?? emptyBucket();
    addToBucket(dayBucket);
    dayMap.set(r.rr_dt, dayBucket);

    // Week
    const d = new Date(`${r.rr_dt}T00:00:00Z`);
    const wk = isoWeekKey(d);
    const w = weekMap.get(wk.key) ?? { label: wk.label, bucket: emptyBucket() };
    addToBucket(w.bucket);
    weekMap.set(wk.key, w);

    // Month
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const monthLabel = `${MONTH_NAMES[d.getUTCMonth()] ?? ''} ${d.getUTCFullYear()}`;
    const m = monthMap.get(monthKey) ?? { label: monthLabel, bucket: emptyBucket() };
    addToBucket(m.bucket);
    monthMap.set(monthKey, m);

    // Channel (пока только WB)
    addToBucket(channelBucket);

    // Product
    const productKey = String(r.nm_id ?? r.barcode ?? 'unknown');
    const productLabel = r.sa_name ?? r.barcode ?? '—';
    const productSublabel = r.barcode ?? '';
    const p = productMap.get(productKey) ?? {
      label: productLabel,
      sublabel: productSublabel,
      bucket: emptyBucket(),
    };
    addToBucket(p.bucket);
    productMap.set(productKey, p);
  }

  // Дни по возрастанию
  const dayRows: SalesReportRow[] = [...dayMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([dayIso, b]) => {
      const d = new Date(`${dayIso}T00:00:00Z`);
      const label = `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const sublabel = WEEKDAY_SHORT[d.getUTCDay()];
      return toRow(dayIso, label, sublabel, b);
    });

  const weekRows: SalesReportRow[] = [...weekMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, v]) => toRow(key, v.label, undefined, v.bucket));

  const monthRows: SalesReportRow[] = [...monthMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, v]) => toRow(key, v.label, undefined, v.bucket));

  const channelRows: SalesReportRow[] = [toRow('WB', 'Wildberries', 'Основной канал', channelBucket)];

  const productRows: SalesReportRow[] = [...productMap.entries()]
    .map(([key, v]) => toRow(key, v.label, v.sublabel, v.bucket))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 200);

  return {
    day: dayRows,
    week: weekRows,
    month: monthRows,
    channel: channelRows,
    product: productRows,
  };
}
