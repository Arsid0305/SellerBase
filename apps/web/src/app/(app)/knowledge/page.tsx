import { PageHeader } from '@/widgets/app-shell/page-header';
import { KnowledgeFeed } from '@/features/investigations';
import { fetchKnowledge } from '@/entities/investigations';

export const metadata = { title: 'Знания' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function KnowledgePage() {
  const items = await fetchKnowledge();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="База знаний"
        description="Подтверждённые выводы из расследований — копится автоматически"
      />
      <KnowledgeFeed items={items} />
      <p className="text-xs text-muted-foreground">
        · Данные из таблицы `knowledge`. Знание создаётся при подтверждении гипотезы.
      </p>
    </div>
  );
}
