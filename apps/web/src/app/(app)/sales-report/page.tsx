import { PageHeader } from '@/widgets/app-shell/page-header';
import { SalesReportExplorer } from '@/features/sales-report';
import { fetchSalesReportAll } from '@/entities/sales-report';
import { lastNDaysRange, type PeriodRange } from '@/entities/pnl';

export const metadata = { title: 'Отчёт по продажам' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Promise<{ from?: string; to?: string }>;

function parseRange(sp: { from?: string; to?: string }): PeriodRange {
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  if (sp.from && sp.to && isoRe.test(sp.from) && isoRe.test(sp.to) && sp.from <= sp.to) {
    return { from: sp.from, to: sp.to };
  }
  return lastNDaysRange(30);
}

export default async function SalesReportPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const range = parseRange(sp);
  const rowsByGrouping = await fetchSalesReportAll(range);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Отчёт по продажам"
        description={`Pivot из wb_reports_fact с 5 группировками · Период выбирается в топбаре`}
      />
      <SalesReportExplorer rowsByGrouping={rowsByGrouping} />
      <p className="text-xs text-muted-foreground">
        · Данные из `wb_reports_fact` за {range.from} — {range.to}. Заказ = строка с положительным quantity, отмена = строка с отрицательным quantity.
      </p>
    </div>
  );
}
