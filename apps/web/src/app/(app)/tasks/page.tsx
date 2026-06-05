import { PageHeader } from '@/widgets/app-shell/page-header';
import { TasksList, TaskForm } from '@/features/tasks';
import { fetchTasks } from '@/entities/tasks';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const metadata = { title: 'Задачи' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type GoalRow = { id: number; title: string | null };
type SkuRow = { id: number; title: string | null; barcode: string | null };

async function fetchGoalsLite(): Promise<{ id: number; title: string }[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('goals')
    .select('id, title')
    .order('id', { ascending: false })
    .range(0, 500);
  if (error) {
    if (error.code === '42P01') return [];
    console.error('[fetchGoalsLite]', error);
    return [];
  }
  return (data ?? []).map((g: GoalRow) => ({ id: g.id, title: g.title ?? 'Без названия' }));
}

async function fetchSkusLite(): Promise<{ id: number; title: string; barcode: string | null }[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sku_catalog')
    .select('id, title, barcode')
    .eq('is_active', true)
    .order('id', { ascending: true })
    .range(0, 2000);
  if (error) {
    if (error.code === '42P01') return [];
    console.error('[fetchSkusLite]', error);
    return [];
  }
  return (data ?? []).map((s: SkuRow) => ({
    id: s.id,
    title: s.title ?? `SKU #${s.id}`,
    barcode: s.barcode,
  }));
}

export default async function TasksPage() {
  const [tasks, goals, skus] = await Promise.all([fetchTasks(), fetchGoalsLite(), fetchSkusLite()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Задачи"
        description="Что нужно сделать: связано с целями и товарами"
      />
      <TaskForm goals={goals} skus={skus} />
      <TasksList tasks={tasks} goals={goals} skus={skus} />
      <p className="text-xs text-muted-foreground">
        · Данные из таблицы `tasks`. Канбан-вид: 4 колонки на десктопе, фильтр-чипы на мобиле.
      </p>
    </div>
  );
}
