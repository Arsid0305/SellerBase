import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import { LEVEL_LABEL, type Level3, type Scenario } from '@/entities/customer';

type Props = { scenarios: Scenario[] };

export const LEVEL_TONE: Record<Level3, string> = {
  low: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  med: 'border-sky-200 bg-sky-50 text-sky-700',
  high: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function ScenariosList({ scenarios }: Props) {
  if (scenarios.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
        <Sparkles className="mx-auto mb-2 h-6 w-6 text-neutral-300" />
        Пока нет сценариев. Опишите контекст в котором покупатель приходит за товаром.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {scenarios.map((s) => (
        <Link
          key={s.id}
          href={`/scenarios/${s.id}`}
          className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-neutral-300"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-semibold text-neutral-900">{s.title}</div>
            <div className="flex shrink-0 items-center gap-1">
              <Badge variant="outline" className={cn(LEVEL_TONE[s.urgency])}>
                Срочность: {LEVEL_LABEL[s.urgency]}
              </Badge>
              <Badge variant="outline" className={cn(LEVEL_TONE[s.priceSensitivity])}>
                Цена: {LEVEL_LABEL[s.priceSensitivity]}
              </Badge>
            </div>
          </div>
          {s.description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-neutral-600">{s.description}</p>
          ) : null}
          {s.trigger ? (
            <div className="text-xs text-neutral-500">
              Триггер: <span className="text-neutral-700">{s.trigger}</span>
            </div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
