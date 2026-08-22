'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';
import type { SeoOverview } from '@/entities/seo';
import { RISK_META } from './risk-badge';

/**
 * Топ повторяющихся находок. Клик по строке ставит находку в фильтр таблицы —
 * так видно не «сколько всего плохо», а какие именно карточки лечит одна правка.
 */
export function SeoFindings({
  findings,
  active,
  onSelect,
}: {
  findings: SeoOverview['topFindings'];
  active: string | null;
  onSelect: (finding: string | null) => void;
}) {
  if (findings.length === 0) return null;
  const max = Math.max(...findings.map((f) => f.count));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Что повторяется чаще всего</CardTitle>
        <CardDescription>
          Одна правка словаря или шаблона закрывает сразу все карточки в строке. Клик — фильтр по
          находке.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 pb-4">
        {findings.map((f) => {
          const meta = RISK_META[f.risk];
          const isActive = active === f.finding;
          return (
            <button
              key={`${f.risk}-${f.finding}`}
              type="button"
              onClick={() => onSelect(isActive ? null : f.finding)}
              title={f.detail}
              aria-pressed={isActive}
              className={cn(
                'hover:bg-accent/40 focus-visible:ring-ring flex items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:ring-1 focus-visible:outline-none',
                isActive && 'bg-accent/60',
              )}
            >
              <span
                className={cn(
                  'w-6 shrink-0 rounded border text-center text-[10px] font-medium uppercase',
                  meta.tone,
                )}
              >
                {meta.short}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{f.finding}</span>
              <span className="bg-muted h-1.5 w-24 shrink-0 overflow-hidden rounded-full">
                <span
                  className={cn(
                    'block h-full rounded-full',
                    f.risk === 'R' ? 'bg-rose-500' : f.risk === 'A' ? 'bg-amber-500' : 'bg-sky-500',
                  )}
                  style={{ width: `${Math.round((f.count / max) * 100)}%` }}
                />
              </span>
              <span className="text-muted-foreground w-10 shrink-0 text-right text-sm tabular-nums">
                {f.count}
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
