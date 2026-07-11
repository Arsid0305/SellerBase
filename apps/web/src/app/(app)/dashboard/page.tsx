import { Download, Info } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import { PageHeader } from '@/widgets/app-shell/page-header';
import { KpiGrid, AnomaliesBanner, LogisticsPulseCard, MorningBrief, CategoriesCard, TopProductsCard, FunnelCard, RatingCard, WbStyleChart, ConstantsTimelineCard } from '@/features/dashboard';
import { fetchConstantsTimeline } from '@/entities/constants-timeline';
import { PnLChart } from '@/features/pnl';
import type { DashboardKpi } from '@/features/dashboard/types';
import {
  fetchPnlAggregate,
  fetchDailyRevenue,
  fetchPnlByCategory,
  fetchTopProductsByRevenue,
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
import { fetchSellerAnalytics } from '@/entities/seller-analytics';
import { fetchSalesComparison } from '@/entities/sales-hourly';
import { fetchOrdersHourlyComparison } from '@/entities/wb-orders';
import { fetchAdsHourlyComparison } from '@/entities/wb-ads';

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

  const [current, previous, series, anomalies, coefNow, coefPrev, brief, categoryPnl, topProducts, sellerAnalytics, salesComparison, ordersComparison, adsComparison, constantsTimeline] = await Promise.all([
    fetchPnlAggregate(range),
    fetchPnlAggregate(comparison),
    fetchDailyRevenue(range),
    fetchAnomalies(),
    fetchAverageWarehouseCoef(),
    fetchAverageWarehouseCoefAtOrBefore(weekAgoIso),
    fetchDashboardBrief(),
    fetchPnlByCategory(lastNDaysRange(30)),
    fetchTopProductsByRevenue(range, 5),
    fetchSellerAnalytics(),
    fetchSalesComparison(),
    fetchOrdersHourlyComparison(),
    fetchAdsHourlyComparison(),
    fetchConstantsTimeline(),
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
  };
  const marginKpi: DashboardKpi = {
    label: 'Маржа',
    value: current.marginPct,
    delta: Math.round((current.marginPct - previous.marginPct) * 10) / 10,
    series: [],
    hint: 'п.п. к прошлому периоду',
  };

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
      {brief.yesterday.date && range.to > brief.yesterday.date && (
        <Card className="border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-start gap-2 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div>
              <span className="font-medium text-amber-700 dark:text-amber-400">
                За выбранный период данных от WB ещё нет.
              </span>{' '}
              <span className="text-muted-foreground">
                Отчёт WB приходит с задержкой 1-2 дня. Последний день с данными:{' '}
                <span className="font-medium text-foreground">
                  {new Date(`${brief.yesterday.date}T00:00:00Z`).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                  })}
                </span>
                . Сдвинь конец периода назад, чтобы увидеть цифры.
              </span>
            </div>
          </div>
        </Card>
      )}
      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 [&>*]:h-full">
          <MorningBrief brief={brief} anomaliesCount={anomalies.length} />
        </div>
        <div className="flex flex-col gap-4 [&>*]:flex-1">
          <FunnelCard funnel={sellerAnalytics.funnel} />
          <RatingCard rating={sellerAnalytics.rating} />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Период: <span className="font-medium text-foreground">{formatRange(range)}</span>
        </span>
        <span>
          Сравнение: <span className="font-medium text-foreground">{formatRange(comparison)}</span>
        </span>
      </div>
      <KpiGrid
        kpis={{
          revenue: revenueKpi,
          mainExpenses: mainExpensesKpi,
          extraExpenses: extraExpensesKpi,
          profit: profitKpi,
          margin: marginKpi,
        }}
        comparison={{ from: comparison.from, to: comparison.to, label: formatRange(comparison) }}
      />
      <WbStyleChart salesBuckets={salesComparison} ordersBuckets={ordersComparison} adsBuckets={adsComparison} />
      <PnLChart data={series} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <CategoriesCard rows={categoryPnl} />
        <AnomaliesBanner anomalies={anomalies} />
        <TopProductsCard rows={topProducts} />
      </div>
      <LogisticsPulseCard current={coefNow} previous={coefPrev} />
      <ConstantsTimelineCard points={constantsTimeline} />
      <p className="text-xs text-muted-foreground">
        · Данные из Supabase: RPC `get_full_pnl_by_period` + агрегация `wb_reports_fact`.
        Период выбирается в топбаре — цифры пересчитываются на сервере.
      </p>
    </div>
  );
}
