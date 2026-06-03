import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';

export type KpiCardProps = {
  label: string;
  value: string;
  delta?: number; // -100..+100 (%) or absolute
  deltaLabel?: string;
  trend?: 'up' | 'down' | 'flat';
  className?: string;
};

/**
 * KpiCard — базовая карточка KPI: значение + дельта + направление.
 * TODO M1: sparkline, tooltip-сравнение периодов, click-to-drilldown.
 */
export function KpiCard({ label, value, delta, deltaLabel, trend, className }: KpiCardProps) {
  const direction = trend ?? (delta == null ? 'flat' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat');
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const tone =
    direction === 'up' ? 'text-emerald-600' : direction === 'down' ? 'text-rose-600' : 'text-muted-foreground';
  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-2 p-5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {delta != null && (
          <span className={cn('inline-flex items-center gap-1 text-sm', tone)}>
            <Icon className="size-4" />
            <span>{delta > 0 ? '+' : ''}{delta}%</span>
            {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
