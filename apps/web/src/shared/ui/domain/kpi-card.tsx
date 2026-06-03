import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { Sparkline } from '@/shared/ui/domain/sparkline';
import { cn } from '@/shared/lib/utils';
import { formatDelta } from '@/shared/lib/format';

export type KpiCardProps = {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  trend?: 'up' | 'down' | 'flat';
  series?: number[];
  hint?: string;
  className?: string;
};

/**
 * KpiCard — базовая карточка KPI: значение + дельта + направление + sparkline.
 */
export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  trend,
  series,
  hint,
  className,
}: KpiCardProps) {
  const direction: 'up' | 'down' | 'flat' =
    trend ?? (delta == null ? 'flat' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat');
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const tone =
    direction === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : direction === 'down'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-muted-foreground';

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="truncate text-2xl font-semibold tracking-tight">{value}</span>
          {delta != null && (
            <span className={cn('inline-flex items-center gap-1 text-sm font-medium', tone)}>
              <Icon className="size-4" />
              <span>{formatDelta(delta)}</span>
              {deltaLabel && <span className="font-normal text-muted-foreground">{deltaLabel}</span>}
            </span>
          )}
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
        {series && series.length > 1 && (
          <Sparkline data={series} trend={direction} className="shrink-0" />
        )}
      </CardContent>
    </Card>
  );
}
