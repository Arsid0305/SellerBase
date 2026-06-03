import { PageHeader } from '@/widgets/app-shell/page-header';

export const metadata = { title: 'Сводка' };

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Сводка"
        description="Главные метрики бизнеса за выбранный период"
      />
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        M1 · KPI-карточки + динамика доходов/расходов + доля каналов · скоро
      </div>
    </div>
  );
}
