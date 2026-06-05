import { PageHeader } from '@/widgets/app-shell/page-header';
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
    </div>
  );
}
