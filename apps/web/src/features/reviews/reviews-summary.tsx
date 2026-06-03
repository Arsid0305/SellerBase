import { Star, MessageSquare, ThumbsUp, Reply } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { formatInt, formatDelta } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { ReviewsSummary } from './types';

export function ReviewsSummaryCards({ summary }: { summary: ReviewsSummary }) {
  const responseHigh = summary.responseRate >= 80;
  const deltaPositive = summary.avgRatingDelta >= 0;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <div className="rounded-md bg-muted p-2 text-muted-foreground">
            <Star className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted-foreground">Средний рейтинг</span>
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {summary.avgRating.toFixed(2)} <span className="text-amber-500">★</span>
            </span>
            <span
              className={cn(
                'text-xs tabular-nums',
                deltaPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
              )}
            >
              {formatDelta(summary.avgRatingDelta)} к прошлому периоду
            </span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <div className="rounded-md bg-muted p-2 text-muted-foreground">
            <MessageSquare className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted-foreground">Всего отзывов</span>
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatInt(summary.totalReviews)}</span>
            <span className="text-xs text-muted-foreground">за последние 30 дней</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <div className="rounded-md bg-muted p-2 text-muted-foreground">
            <ThumbsUp className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted-foreground">Доля положительных</span>
            <span className="text-2xl font-semibold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
              {summary.positiveShare.toFixed(0)}%
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              негативных {summary.negativeShare.toFixed(0)}%
            </span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <div className="rounded-md bg-muted p-2 text-muted-foreground">
            <Reply className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted-foreground">Скорость ответа</span>
            <span
              className={cn(
                'text-2xl font-semibold tracking-tight tabular-nums',
                responseHigh
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400',
              )}
            >
              {summary.responseRate.toFixed(0)}%
            </span>
            <span className="text-xs text-muted-foreground">{responseHigh ? 'в норме' : 'ниже цели 80%'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
