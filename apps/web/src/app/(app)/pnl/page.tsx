import { PageHeader } from '@/widgets/app-shell/page-header';
import { ProfitSummary, ExpenseBreakdown, ProfitMarginChart } from '@/features/pnl';
import type { PnlKpis } from '@/features/pnl/types';
import {
  fetchPnlAggregate,
  fetchPnlBreakdown,
  fetchDailyMarginSeries,
  shiftRangeBack,
  lastNDaysRange,
  type PeriodRange,
} from '@/entities/pnl';

export const metadata = { title: 'Прибыль и убытки' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Promise<{ from?: string; to?: string }>;

function formatRange(range: PeriodRange): string {
  const months = [
    'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
    'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
  ];
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return `${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()] ?? ''}`;
  };
  return `${fmt(range.from)} — ${fmt(range.to)}`;
}

function parseRange(sp: { from?: string; to?: string }): PeriodRange {
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  if (sp.from && sp.to && isoRe.test(sp.from) && isoRe.test(sp.to) && sp.from <= sp.to) {
    return { from: sp.from, to: sp.to };
  }
  return lastNDaysRange(30);
}

function calcDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default async function PnLPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const range = parseRange(sp);
  const comparison = shiftRangeBack(range);

  const [current, previous, breakdown, marginSeries] = await Promise.all([
    fetchPnlAggregate(range),
    fetchPnlAggregate(comparison),
    fetchPnlBreakdown(range, comparison),
    fetchDailyMarginSeries(range),
  ]);

  const totalExpenses = current.mainExpenses + current.extraExpenses;
  const totalExpensesPrev = previous.mainExpenses + previous.extraExpenses;

  const kpis: PnlKpis = {
    revenue: {
      value: current.revenue,
      delta: Math.round(calcDelta(current.revenue, previous.revenue)),
      series: [],
    },
    expenses: {
      value: totalExpenses,
      delta: Math.round(calcDelta(totalExpenses, totalExpensesPrev)),
      series: [],
    },
    profit: {
      value: current.profit,
      delta: Math.round(calcDelta(current.profit, previous.profit)),
      series: [],
    },
    margin: {
      value: current.marginPct,
      delta: Math.round((current.marginPct - previous.marginPct) * 10) / 10,
      series: [],
    },
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Прибыль и убытки"
        description={`Реальная прибыль с учётом всех комиссий · Текущий: ${formatRange(range)} · Сравнение: ${formatRange(comparison)}`}
      />
      <ProfitSummary kpis={kpis} comparisonLabel={formatRange(comparison)} />
      <ProfitMarginChart data={marginSeries} />
      <ExpenseBreakdown categories={breakdown.categories} totalRevenue={breakdown.revenue} />
      <p className="text-xs text-muted-foreground">
        · Данные из RPC `get_full_pnl_by_period` (разбивка по статьям) и `wb_reports_fact` (дневная маржа).
      </p>
    </div>
  );
}
