import { PageHeader } from '@/widgets/app-shell/page-header';

export const metadata = { title: 'Отчёт по продажам' };

export default function SalesReportPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Отчёт по продажам"
        description="Pivot-таблица для бухгалтерии и сверки"
      />
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        M6 · Pivot-таблица периоды × каналы × товары · скоро
      </div>
    </div>
  );
}
