import { PageHeader } from '@/widgets/app-shell/page-header';
import { SourcesSummaryCards, SourcesTable } from '@/features/sources';
import { fetchSourcesByPeriod } from '@/entities/sources';
import { lastNDaysRange, type PeriodRange } from '@/entities/pnl';

export const metadata = { title: 'Источники заказов' };
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

export default async function SourcesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const range = parseRange(sp);
  const { rows, summary } = await fetchSourcesByPeriod(range);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Источники заказов"
        description={`Откуда идут продажи — распределение по складам WB. Период выбирается в топбаре.`}
      />
      <SourcesSummaryCards summary={summary} />
      <SourcesTable rows={rows} />
      <p className="text-xs text-muted-foreground">
        · Данные из `wb_reports_fact.warehouse_name` за {range.from} — {range.to}.
      </p>
    </div>
  );
}
