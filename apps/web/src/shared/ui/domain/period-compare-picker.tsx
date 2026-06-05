'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CalendarRange, Check, Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';

export type PeriodPreset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'quarter' | 'half' | 'year' | 'custom';

const PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: 'today', label: 'Сегодня' },
  { key: 'yesterday', label: 'Вчера' },
  { key: '7d', label: '7 дней' },
  { key: '30d', label: '30 дней' },
  { key: 'month', label: 'Месяц' },
  { key: 'quarter', label: 'Квартал' },
  { key: 'half', label: 'Полгода' },
  { key: 'year', label: 'Год' },
];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetToRange(preset: PeriodPreset): { from: string; to: string } | null {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  switch (preset) {
    case 'today':
      return { from: iso(today), to: iso(today) };
    case 'yesterday': {
      const y = new Date(today);
      y.setUTCDate(y.getUTCDate() - 1);
      return { from: iso(y), to: iso(y) };
    }
    case '7d': {
      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() - 6);
      return { from: iso(from), to: iso(today) };
    }
    case '30d': {
      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() - 29);
      return { from: iso(from), to: iso(today) };
    }
    case 'month': {
      const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      return { from: iso(from), to: iso(today) };
    }
    case 'quarter': {
      const q = Math.floor(today.getUTCMonth() / 3);
      const from = new Date(Date.UTC(today.getUTCFullYear(), q * 3, 1));
      return { from: iso(from), to: iso(today) };
    }
    case 'half': {
      const from = new Date(today);
      from.setUTCMonth(from.getUTCMonth() - 6);
      return { from: iso(from), to: iso(today) };
    }
    case 'year': {
      const from = new Date(today);
      from.setUTCFullYear(from.getUTCFullYear() - 1);
      return { from: iso(from), to: iso(today) };
    }
    case 'custom':
      return null;
  }
}

function matchPreset(from: string, to: string): PeriodPreset {
  for (const { key } of PRESETS) {
    const r = presetToRange(key);
    if (r && r.from === from && r.to === to) return key;
  }
  return 'custom';
}

function formatLabel(from: string, to: string, preset: PeriodPreset): string {
  const found = PRESETS.find((p) => p.key === preset);
  if (found) return found.label;
  return `${from} — ${to}`;
}

export function PeriodComparePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlFrom = searchParams.get('from');
  const urlTo = searchParams.get('to');

  const defaultRange = presetToRange('30d');
  const activeFrom = urlFrom ?? defaultRange?.from ?? '';
  const activeTo = urlTo ?? defaultRange?.to ?? '';
  const activePreset: PeriodPreset = matchPreset(activeFrom, activeTo);

  const [customFrom, setCustomFrom] = useState(activeFrom);
  const [customTo, setCustomTo] = useState(activeTo);

  const applyRange = (from: string, to: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', from);
    params.set('to', to);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const onPreset = (key: PeriodPreset) => {
    const r = presetToRange(key);
    if (r) applyRange(r.from, r.to);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[40vw] gap-2 sm:max-w-none">
          {pending ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <CalendarRange className="size-4 shrink-0" />}
          <span className="truncate">{formatLabel(activeFrom, activeTo, activePreset)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-[90vw] p-2">
        <div className="px-2 pb-1 pt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          Период анализа
        </div>
        {PRESETS.map((p) => (
          <DropdownMenuItem
            key={p.key}
            onSelect={() => onPreset(p.key)}
            className="flex items-center justify-between"
          >
            <span className={cn(p.key === activePreset && 'font-semibold')}>{p.label}</span>
            {p.key === activePreset && <Check className="size-3.5" />}
          </DropdownMenuItem>
        ))}

        <div className="my-1 h-px bg-border" />

        <div className="px-2 pb-1 pt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          Произвольный диапазон
        </div>
        <div className="flex flex-col gap-2 px-2 py-1">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-3 text-center">С</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-3 text-center">По</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          </label>
          <Button
            size="sm"
            disabled={!customFrom || !customTo || customFrom > customTo}
            onClick={() => applyRange(customFrom, customTo)}
          >
            Применить
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
