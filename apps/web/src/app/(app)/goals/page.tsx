import { PageHeader } from '@/widgets/app-shell/page-header';
<<<<<<< HEAD
import { DemoControls, DemoEmptyHint } from '@/widgets/demo-controls';
import { createAdminClient } from '@/shared/lib/supabase/admin';

export const metadata = { title: 'Цели' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type GoalRow = {
  id: number;
  title: string;
  metric: string | null;
  target: number | null;
  status: string | null;
  deadline: string | null;
  source: string | null;
};

async function fetchGoals(): Promise<GoalRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('goals')
    .select('id, title, metric, target, status, deadline, source')
    .order('id', { ascending: false })
    .range(0, 500);
  if (error) {
    if (error.code === '42P01') return [];
    console.error('[fetchGoals]', error);
    return [];
  }
  return (data ?? []) as GoalRow[];
}

export default async function GoalsPage() {
  const goals = await fetchGoals();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Цели" description="Ключевые цели бизнеса с целевыми метриками" />
        <DemoControls scope="goals" />
      </div>
      {goals.length === 0 ? (
        <DemoEmptyHint scope="goals" />
      ) : (
        <ul className="flex flex-col gap-2">
          {goals.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between gap-4 rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium">{g.title}</span>
                <span className="text-xs text-neutral-500">
                  {g.metric ?? '—'} · цель {g.target ?? '—'} · {g.deadline ?? 'без срока'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                  {g.status ?? '—'}
                </span>
                {g.source === 'demo' ? (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">
                    demo
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
=======
import { fetchGoals } from '@/entities/goals';
import { GoalsList } from '@/features/goals';

export const metadata = { title: 'Цели' };
export const dynamic = 'force-dynamic';

export default async function GoalsPage() {
  const goals = await fetchGoals();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Цели"
        description="Управляйте бизнес-целями: выручка, маржа, штуки. Отслеживайте прогресс и дедлайны."
      />
      <GoalsList goals={goals} />
>>>>>>> origin/main
    </div>
  );
}
