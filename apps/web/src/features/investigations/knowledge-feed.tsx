import { Badge } from '@/shared/ui/badge';
import {
  KNOWLEDGE_CATEGORY_LABEL,
  type KnowledgeItem,
} from '@/entities/investigations';

type Props = {
  items: KnowledgeItem[];
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function KnowledgeFeed({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
        База знаний пуста. Подтверждённые гипотезы автоматически предлагается записать сюда.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((k) => (
        <div
          key={k.id}
          className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-semibold text-neutral-900">{k.title}</div>
            {k.category ? (
              <Badge variant="outline" className="shrink-0 border-neutral-200 bg-neutral-50 text-neutral-700">
                {KNOWLEDGE_CATEGORY_LABEL[k.category]}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm leading-relaxed text-neutral-700">{k.insight}</p>
          <div className="text-xs text-neutral-500">{formatDate(k.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}
