'use client';

import { useState } from 'react';
import { CalendarRange, Check } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import {
  useFiltersStore,
  periodLabel,
  comparisonLabel,
  type PeriodPreset,
} from '@/shared/stores/filters';

const PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: 'today', label: 'Сегодня' },
  { key: 'yesterday', label: 'Вчера' },
  { key: '7d', label: '7 дней' },
  { key: '30d', label: '30 дней' },
  { key: 'month', label: 'Месяц' },
  { key: 'quarter', label: 'Квартал' },
];

export function PeriodComparePicker() {
  const period = useFiltersStore((s) => s.period);
  const customRange = useFiltersStore((s) => s.customRange);
  const setPeriod = useFiltersStore((s) => s.setPeriod);
  const setCustomRange = useFiltersStore((s) => s.setCustomRange);

  const [from, setFrom] = useState(customRange?.from ?? '');
  const [to, setTo] = useState(customRange?.to ?? '');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarRange className="size-4" />
          <span>{periodLabel(period, customRange)}</span>
          <span className="hidden text-muted-foreground sm:inline">vs {comparisonLabel(period)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2">
        <div className="px-2 pb-1 pt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          Период анализа
        </div>
        {PRESETS.map((p) => (
          <DropdownMenuItem
            key={p.key}
            onSelect={() => setPeriod(p.key)}
            className="flex items-center justify-between"
          >
            <span className={cn(p.key === period && 'font-semibold')}>{p.label}</span>
            {p.key === period && <Check className="size-3.5" />}
          </DropdownMenuItem>
        ))}

        <div className="my-1 h-px bg-border" />

        <div className="px-2 pb-1 pt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          Произвольный диапазон
        </div>
        <div className="flex flex-col gap-2 px-2 py-1">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            С
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            По
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          </label>
          <Button
            size="sm"
            disabled={!from || !to || from > to}
            onClick={() => {
              if (from && to && from <= to) setCustomRange({ from, to });
            }}
          >
            Применить
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
