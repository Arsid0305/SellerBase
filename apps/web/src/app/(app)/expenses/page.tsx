import { PageHeader } from '@/widgets/app-shell/page-header';

export const metadata = { title: 'Мои расходы' };

export default function ExpensesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Мои расходы" description="Ручной ввод дополнительных расходов" />
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
        Появится вместе с M2 (P&L)
      </div>
    </div>
  );
}
