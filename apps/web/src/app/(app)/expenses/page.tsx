import { PageHeader } from '@/widgets/app-shell/page-header';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { ExpensesExplorer } from '@/features/expenses/expenses-explorer';

export const metadata = { title: 'Мои расходы' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ExpenseDb = {
  id: number;
  dt: string;
  category: string;
  amount_rub: number;
  note: string | null;
};

export default async function ExpensesPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('manual_expenses')
    .select('id, dt, category, amount_rub, note')
    .order('dt', { ascending: false })
    .order('id', { ascending: false })
    .limit(500);

  const rows = ((data ?? []) as ExpenseDb[]).map((r) => ({
    id: r.id,
    dt: r.dt,
    category: r.category as 'Реклама вне WB' | 'Упаковка' | 'Зарплата' | 'Прочее',
    amount_rub: Number(r.amount_rub),
    note: r.note,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Мои расходы"
        description="Ручной ввод дополнительных расходов (реклама вне WB, упаковка, зарплата, прочее)"
      />
      <ExpensesExplorer initialRows={rows} />
      <p className="text-xs text-muted-foreground">
        · Источник: `manual_expenses`. Интеграция в P&L отдельной строкой «Прочие расходы» — задача 18a.
      </p>
    </div>
  );
}
