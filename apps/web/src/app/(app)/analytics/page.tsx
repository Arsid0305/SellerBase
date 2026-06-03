import { PageHeader } from '@/widgets/app-shell/page-header';
import {
  ProfitabilityMatrix,
  StabilitySegments,
  AnalyticsSummaryCards,
  AnalyticsTable,
  profitabilityMatrix,
  stabilitySegments,
  mockAnalyticsRows,
  mockAnalyticsSummary,
} from '@/features/analytics';

export const metadata = { title: 'Товарная аналитика' };

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Товарная аналитика"
        description="ABC × XYZ матрица, прибыльность и оборачиваемость товаров"
      />
      <AnalyticsSummaryCards summary={mockAnalyticsSummary} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProfitabilityMatrix cells={profitabilityMatrix} />
        <StabilitySegments segments={stabilitySegments} />
      </div>
      <AnalyticsTable rows={mockAnalyticsRows} />
      <p className="text-xs text-muted-foreground">
        · Данные mock-фикстуры. Реальные расчёты ABC/XYZ поверх заказов/остатков подключатся в следующем PR.
      </p>
    </div>
  );
}
