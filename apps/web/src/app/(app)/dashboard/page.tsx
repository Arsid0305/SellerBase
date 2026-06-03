import { PageHeader } from '@/widgets/app-shell/page-header';
import { KpiGrid, RevenueExpensesChart, ChannelsDonut } from '@/features/dashboard';
import type { ChannelShare, DashboardKpi } from '@/features/dashboard/types';
import { fetchPnlAggregate, fetchDailyRevenue, shiftRangeBack, lastNDaysRange } from '@/entities/pnl';

export const metadata = { title: 'Сводка' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function formatRange(range: { from: string; to: string }): string {
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

export default async function DashboardPage() {
  const range = lastNDaysRange(30);
  const comparison = shiftRangeBack(range);

  const [current, previous, series] = await Promise.all([
    fetchPnlAggregate(range),
    fetchPnlAggregate(comparison),
    fetchDailyRevenue(range),
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

  // Каналы: в БД пока только WB, Ozon подключится позже.
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
      <PageHeader
        title="Сводка"
        description={`Текущий: ${formatRange(range)} · Сравнение: ${formatRange(comparison)}`}
      />
      <KpiGrid
        kpis={{
          revenue: revenueKpi,
          mainExpenses: mainExpensesKpi,
          extraExpenses: extraExpensesKpi,
          profit: profitKpi,
        }}
        comparison={{ from: comparison.from, to: comparison.to, label: formatRange(comparison) }}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueExpensesChart data={series} />
        </div>
        <ChannelsDonut channels={channels} />
      </div>
      <p className="text-xs text-muted-foreground">
        · Данные из вашего Supabase: RPC `get_full_pnl_by_period` + агрегация `wb_reports_fact` по дням.
      </p>
    </div>
  );
}
