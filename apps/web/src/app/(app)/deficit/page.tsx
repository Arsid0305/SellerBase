import { PageHeader } from '@/widgets/app-shell/page-header';
import { DataTable } from '@/shared/ui/domain/data-table';
import {
  DeficitSummaryCards,
  deficitColumns,
  mockDeficitRows,
  mockDeficitSummary,
} from '@/features/deficit';

export const metadata = { title: 'Дефицит товаров' };

export default function DeficitPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Дефицит товаров"
        description="Что заканчивается и сколько денег теряется на упущенных продажах"
      />
      <DeficitSummaryCards summary={mockDeficitSummary} />
      <DataTable
        data={mockDeficitRows}
        columns={deficitColumns}
        initialSort={[{ id: 'lostRevenue', desc: true }]}
        rowKey={(row) => row.id}
      />
      <p className="text-xs text-muted-foreground">
        · Данные mock-фикстуры. Реальные из `v_supply_recommendation` подключатся в следующем PR.
      </p>
    </div>
  );
}
