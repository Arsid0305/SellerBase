import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { ReviewsSummary } from './types';

const STAR_LEVELS: (1 | 2 | 3 | 4 | 5)[] = [5, 4, 3, 2, 1];

function starsLabel(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function starColor(n: number): string {
  if (n >= 4) return 'text-emerald-600 dark:text-emerald-400';
  if (n === 3) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function barColor(n: number): string {
  if (n >= 4) return 'bg-emerald-500/70';
  if (n === 3) return 'bg-amber-500/70';
  return 'bg-rose-500/70';
}

export function RatingDistribution({ summary }: { summary: ReviewsSummary }) {
  const total = summary.totalReviews;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-muted-foreground">Распределение оценок</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/60">
          {STAR_LEVELS.map((n) => {
            const count = summary.ratingDistribution[n];
            const pct = total ? (count / total) * 100 : 0;
            return (
              <div key={n} className="flex items-center gap-4 py-2.5">
                <span className={cn('w-24 font-mono text-sm tracking-tight', starColor(n))}>{starsLabel(n)}</span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-all', barColor(n))}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-24 text-right text-sm tabular-nums text-muted-foreground">
                  {formatInt(count)} ({pct.toFixed(0)}%)
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
