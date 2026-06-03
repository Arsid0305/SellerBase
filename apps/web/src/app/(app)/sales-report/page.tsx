import { PageHeader } from '@/widgets/app-shell/page-header';
import { SalesReportExplorer } from '@/features/sales-report';

export const metadata = { title: 'Отчёт по продажам' };

export default function SalesReportPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Отчёт по продажам"
        description="Pivot по периодам, каналам и товарам — для бухгалтерии и сверки"
      />
      <SalesReportExplorer />
      <p className="text-xs text-muted-foreground">
        · Данные mock-фикстуры. Реальные из таблицы заказов + агрегации подключатся в следующем PR.
      </p>
    </div>
  );
}
