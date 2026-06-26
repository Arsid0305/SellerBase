import { Download } from 'lucide-react';
import { PageHeader } from '@/widgets/app-shell/page-header';
import { ExpenseBreakdown, IncomeBreakdown, PnlSkuTable, PnLChart, ProfitSummary } from '@/features/pnl';
import {
  fetchPnlBreakdown,
  fetchPnlKpis,
  fetchPnlByCategory,
  fetchPnlSkuTable,
  fetchDailyRevenue,
  shiftRangeBack,
  lastNDaysRange,
  type PeriodRange,
} from '@/entities/pnl';

export const metadata = { title: 'Прибыль и убытки' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Promise<{ from?: string; to?: string; year?: string }>;

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

export default async function PnLPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const range = parseRange(sp);
  const comparison = shiftRangeBack(range);

  const [breakdown, skuRows, dailySeries, kpis, incomeByCategory] = await Promise.all([
    fetchPnlBreakdown(range, comparison),
    fetchPnlSkuTable(range),
    fetchDailyRevenue(range),
    fetchPnlKpis(range, comparison),
    fetchPnlByCategory(range),
  ]);

  const year = new Date().getUTCFullYear();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Прибыль и убытки"
          description={`Детализация по товарам и статьям расходов · ${formatRange(range)}`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/finance/xlsx?year=${year}`}
            download
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            <Download className="size-4" />
            Шаблон CF_PL за {year}
          </a>
          <a
            href={`/api/finance/xlsx?year=${year - 1}`}
            download
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <Download className="size-4" />
            За {year - 1}
          </a>
          <a
            href={`/api/finance/pl-wb-xlsx?year=${year}`}
            download
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            <Download className="size-4" />
            Скачать P&L WB (формат владелицы)
          </a>
        </div>
      </div>

      <ProfitSummary kpis={kpis} comparisonLabel={formatRange(comparison)} />

      <PnLChart data={dailySeries} />

      <div className="grid gap-6 lg:grid-cols-2">
        <IncomeBreakdown rows={incomeByCategory} />
        <ExpenseBreakdown categories={breakdown.categories} totalRevenue={breakdown.revenue} />
      </div>

      <PnlSkuTable rows={skuRows} />

      <p className="text-xs text-muted-foreground">
        · Данные из RPC `get_full_pnl_by_period` (per-SKU разбивка) + шаблон `CF_PL_2026.xlsx` (выгрузка по неделям).
        Период выбирается в топбаре — таблица и разбивка пересчитываются на сервере.
      </p>
    </div>
  );
}
