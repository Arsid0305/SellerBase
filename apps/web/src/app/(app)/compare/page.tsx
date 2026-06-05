import { PageHeader } from '@/widgets/app-shell/page-header';
import {
  fetchPnlAggregate,
  fetchDailyRevenue,
  fetchPnlSkuRows,
  shiftRangeBack,
  lastNDaysRange,
  type PeriodRange,
} from '@/entities/pnl';
import {
  DualPeriodPicker,
  CompareKpiTable,
  DualRevenueChart,
  SkuDiffTables,
  buildSkuDiffs,
  type CompareMetric,
} from '@/features/compare';

export const metadata = { title: 'Сравнение периодов' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Promise<{
  from_a?: string;
  to_a?: string;
  from_b?: string;
  to_b?: string;
}>;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseRange(from: string | undefined, to: string | undefined): PeriodRange | null {
  if (!from || !to) return null;
  if (!ISO_RE.test(from) || !ISO_RE.test(to)) return null;
  if (from > to) return null;
  return { from, to };
}

function formatRange(range: PeriodRange): string {
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return `${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()] ?? ''}`;
  };
  return `${fmt(range.from)} — ${fmt(range.to)}`;
}

function avgCheck(revenue: number, units: number): number {
  return units > 0 ? revenue / units : 0;
}

export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const rangeA = parseRange(sp.from_a, sp.to_a) ?? lastNDaysRange(30);
  const rangeB = parseRange(sp.from_b, sp.to_b) ?? shiftRangeBack(rangeA);

  const [aggA, aggB, dailyA, dailyB, skuA, skuB] = await Promise.all([
    fetchPnlAggregate(rangeA),
    fetchPnlAggregate(rangeB),
    fetchDailyRevenue(rangeA),
    fetchDailyRevenue(rangeB),
    fetchPnlSkuRows(rangeA),
    fetchPnlSkuRows(rangeB),
  ]);

  const labelA = formatRange(rangeA);
  const labelB = formatRange(rangeB);

  const metrics: CompareMetric[] = [
    { label: 'Выручка', a: aggA.revenue, b: aggB.revenue, kind: 'money' },
    { label: 'Шт продано', a: aggA.unitsSold, b: aggB.unitsSold, kind: 'units' },
    { label: 'Основные расходы', a: aggA.mainExpenses, b: aggB.mainExpenses, kind: 'money', inverted: true },
    { label: 'Доп. расходы', a: aggA.extraExpenses, b: aggB.extraExpenses, kind: 'money', inverted: true },
    { label: 'Прибыль', a: aggA.profit, b: aggB.profit, kind: 'money' },
    { label: 'Маржа %', a: aggA.marginPct, b: aggB.marginPct, kind: 'pct' },
    {
      label: 'Средний чек',
      a: avgCheck(aggA.revenue, aggA.unitsSold),
      b: avgCheck(aggB.revenue, aggB.unitsSold),
      kind: 'money',
    },
  ];

  const skuDiffs = buildSkuDiffs(skuA, skuB);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Сравнение периодов"
        description={`Side-by-side по всем основным KPI · A: ${labelA} · B: ${labelB}`}
      />
      <DualPeriodPicker initialA={rangeA} initialB={rangeB} />
      <CompareKpiTable metrics={metrics} labelA={labelA} labelB={labelB} />
      <DualRevenueChart seriesA={dailyA} seriesB={dailyB} labelA={labelA} labelB={labelB} />
      <SkuDiffTables rows={skuDiffs} />
      <p className="text-xs text-muted-foreground">
        · Данные из RPC `get_full_pnl_by_period` (агрегат и SKU) и `wb_reports_fact` (дневная выручка).
      </p>
    </div>
  );
}
