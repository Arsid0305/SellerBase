import { Download } from 'lucide-react';
import { PageHeader } from '@/widgets/app-shell/page-header';
import { KpiGrid, RevenueExpensesChart, ChannelsDonut, AnomaliesBanner, LogisticsPulseCard, MorningBrief, CategoriesCard } from '@/features/dashboard';
import type { ChannelShare, DashboardKpi } from '@/features/dashboard/types';
import {
  fetchPnlAggregate,
  fetchDailyRevenue,
  fetchPnlByCategory,
  shiftRangeBack,
  lastNDaysRange,
  type PeriodRange,
} from '@/entities/pnl';
import { fetchAnomalies } from '@/entities/anomalies';
import {
  fetchAverageWarehouseCoef,
  fetchAverageWarehouseCoefAtOrBefore,
} from '@/entities/wb-tariffs';
import { fetchDashboardBrief } from '@/entities/dashboard-brief';

export const metadata = { title: 'Сводка' };
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

function calcDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function parseRange(sp: { from?: string; to?: string }): PeriodRange {
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  if (sp.from && sp.to && isoRe.test(sp.from) && isoRe.test(sp.to) && sp.from <= sp.to) {
    return { from: sp.from, to: sp.to };
  }
  return lastNDaysRange(30);
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const range = parseRange(sp);
  const comparison = shiftRangeBack(range);

  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const weekAgoIso = weekAgo.toISOString().slice(0, 10);

  const [current, previous, series, anomalies, coefNow, coefPrev, brief, categoryPnl] = await Promise.all([
    fetchPnlAggregate(range),
    fetchPnlAggregate(comparison),
    fetchDailyRevenue(range),
    fetchAnomalies(),
    fetchAverageWarehouseCoef(),
    fetchAverageWarehouseCoefAtOrBefore(weekAgoIso),
    fetchDashboardBrief(),
    fetchPnlByCategory(lastNDaysRange(30)),
  ]);

  const revenueKpi: DashboardKpi = {
    label: 'Доходы',
    value: current.revenue,
    delta: Math.round(calcDelta(current.revenue, previous.revenue)),
    series: [],
    hint: `${Math.round(current.unitsSold).toLocaleString('ru-RU')} шт. продано`,
  };
  const mainExpensesKpi: DashboardKpi = {
    label: 'Основные расходы',
    value: current.mainExpenses,
    delta: Math.round(calcDelta(current.mainExpenses, previous.mainExpenses)),
    series: [],
    hint: 'Комиссия + логистика + себестоимость',
  };
  const extraExpensesKpi: DashboardKpi = {
    label: 'Доп. расходы',
    value: current.extraExpenses,
    delta: Math.round(calcDelta(current.extraExpenses, previous.extraExpenses)),
    series: [],
    hint: 'Маркетинг + налог',
  };
  const profitKpi: DashboardKpi = {
    label: 'Прибыль',
    value: current.profit,
    delta: Math.round(calcDelta(current.profit, previous.profit)),
    series: [],
    hint: `Маржа ${current.marginPct.toFixed(1)}%`,
  };

  const channels: ChannelShare[] = [
    {
      channel: 'WB',
      label: 'Wildberries',
      share: current.revenue > 0 ? 100 : 0,
      delta: 0,
      amount: current.revenue,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Сводка"
          description={`Текущий: ${formatRange(range)} · Сравнение: ${formatRange(comparison)}`}
        />
        <a
          href="/api/finance/xlsx"
          download
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Download className="size-4" />
          Скачать XLSX
        </a>
      </div>
      <MorningBrief brief={brief} anomaliesCount={anomalies.length} />
      <AnomaliesBanner anomalies={anomalies} />
      <KpiGrid
        kpis={{
          revenue: revenueKpi,
          mainExpenses: mainExpensesKpi,
          extraExpenses: extraExpensesKpi,
          profit: profitKpi,
        }}
        comparison={{ from: comparison.from, to: comparison.to, label: formatRange(comparison) }}
      />
      <LogisticsPulseCard current={coefNow} previous={coefPrev} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueExpensesChart data={series} />
        </div>
        <ChannelsDonut channels={channels} />
      </div>
      <CategoriesCard rows={categoryPnl} />
      <p className="text-xs text-muted-foreground">
        · Данные из Supabase: RPC `get_full_pnl_by_period` + агрегация `wb_reports_fact`.
        Период выбирается в топбаре — цифры пересчитываются на сервере.
      </p>
    </div>
  );
}
