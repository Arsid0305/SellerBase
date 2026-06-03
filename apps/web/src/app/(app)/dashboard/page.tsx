import { PageHeader } from '@/widgets/app-shell/page-header';
import {
  KpiGrid,
  RevenueExpensesChart,
  ChannelsDonut,
  mockDashboardSummary,
} from '@/features/dashboard';

export const metadata = { title: 'Сводка' };

export default function DashboardPage() {
  const data = mockDashboardSummary;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Сводка"
        description={`Текущий: ${data.period.label} · Сравнение: ${data.comparison.label}`}
      />
      <KpiGrid kpis={data.kpis} comparison={data.comparison} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueExpensesChart data={data.series} />
        </div>
        <ChannelsDonut channels={data.channels} />
      </div>
      <p className="text-xs text-muted-foreground">
        · Данные mock-фикстуры. Реальные из `get_full_pnl_by_period()` подключатся в следующем PR.
      </p>
    </div>
  );
}
