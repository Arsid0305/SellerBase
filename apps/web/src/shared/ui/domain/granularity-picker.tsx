'use client';

import { Button } from '@/shared/ui/button';
import { TooltipIcon } from '@/shared/ui/tooltip-icon';
import { cn } from '@/shared/lib/utils';
import type { Granularity } from '@/shared/lib/granularity';

const LABELS: Record<Granularity, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
  quarter: 'Квартал',
  year: 'Год',
};

const ALL_GRANULARITIES: Granularity[] = ['day', 'week', 'month', 'quarter', 'year'];

export type GranularityPickerProps = {
  value: Granularity;
  onChange: (value: Granularity) => void;
  granularities?: Granularity[];
  className?: string;
};

export function GranularityPicker({
  value,
  onChange,
  granularities = ALL_GRANULARITIES,
  className,
}: GranularityPickerProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="inline-flex items-center gap-1 rounded-md border border-input bg-background p-0.5">
        {granularities.map((g) => {
          const active = g === value;
          return (
            <Button
              key={g}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              className={cn(
                'h-7 border-0 px-2.5 shadow-none',
                !active && 'text-muted-foreground',
              )}
              onClick={() => onChange(g)}
              aria-pressed={active}
            >
              {LABELS[g]}
            </Button>
          );
        })}
      </div>
      <TooltipIcon text="Гранулярность данных — день/неделя/месяц/квартал/год" />
    </div>
  );
}
