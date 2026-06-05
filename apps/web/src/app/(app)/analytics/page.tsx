import { PageHeader } from '@/widgets/app-shell/page-header';
import {
  ProfitabilityMatrix,
  StabilitySegments,
  AnalyticsSummaryCards,
  AnalyticsTable,
} from '@/features/analytics';
import { fetchAnalytics } from '@/entities/analytics';

export const metadata = { title: 'Товарная аналитика' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AnalyticsPage() {
  const { rows, profitabilityMatrix, stabilitySegments, summary } = await fetchAnalytics();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Товарная аналитика"
        description="ABC×XYZ матрица, прибыльность и стабильность товаров"
      />
      <AnalyticsSummaryCards summary={summary} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProfitabilityMatrix cells={profitabilityMatrix} />
        <StabilitySegments segments={stabilitySegments} />
      </div>
      <AnalyticsTable rows={rows} />
      <p className="text-xs text-muted-foreground">
        · Данные из `sku_catalog` + RPC `get_full_pnl_by_period` + `wb_reports_fact` (30 дней). ABC по накопленной выручке (80/15/5), XYZ по коэф. вариации дневных продаж.
      </p>
    </div>
  );
}
