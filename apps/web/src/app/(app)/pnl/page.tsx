import { PageHeader } from '@/widgets/app-shell/page-header';
import {
  ProfitSummary,
  ExpenseBreakdown,
  ProfitMarginChart,
  mockPnlSummary,
} from '@/features/pnl';

export const metadata = { title: 'Прибыль и убытки' };

export default function PnLPage() {
  const data = mockPnlSummary;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Прибыль и убытки"
        description={`Реальная прибыль с учётом всех комиссий и расходов · Текущий: ${data.period.label} · Сравнение: ${data.comparison.label}`}
      />
      <ProfitSummary kpis={data.kpis} comparisonLabel={data.comparison.label} />
      <ProfitMarginChart data={data.marginSeries} />
      <ExpenseBreakdown categories={data.categories} totalRevenue={data.kpis.revenue.value} />
      <p className="text-xs text-muted-foreground">
        · Данные mock-фикстуры. Реальные из `get_full_pnl_by_period()` подключатся в следующем PR.
      </p>
    </div>
  );
}
