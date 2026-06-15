'use client';

import { useState } from 'react';
import { CheckCircle2, Activity, AlertTriangle, Boxes, Info } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/ui/tooltip';
import { formatRub, formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { TurnoverSegment, TurnoverSegmentKey } from './types';

const SEGMENT_HINT: Record<TurnoverSegmentKey, string> = {
  all: 'Все товары вне зависимости от сегмента оборачиваемости.',
  stable: 'Стабильная: хватит 30–90 дней. Здоровый товарооборот, остатков и продаж в балансе.',
  medium: 'Средняя: хватит 7–30 или 90–180 дней. На грани — стоит следить за поставками или распродажей.',
  unstable:
    'Нестабильная: хватит <7 дней (дефицит), >180 дней (избыток) или нет продаж. Требует решения по поставкам.',
};

const SEGMENT_STYLE: Record<
  TurnoverSegmentKey,
  { tone: string; icon: typeof Boxes; activeRing: string }
> = {
  all: { tone: 'text-foreground', icon: Boxes, activeRing: 'ring-foreground/40' },
  stable: {
    tone: 'text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
    activeRing: 'ring-emerald-500/50',
  },
  medium: {
    tone: 'text-amber-700 dark:text-amber-300',
    icon: Activity,
    activeRing: 'ring-amber-500/50',
  },
  unstable: {
    tone: 'text-rose-700 dark:text-rose-300',
    icon: AlertTriangle,
    activeRing: 'ring-rose-500/50',
  },
};

export function TurnoverSegments({
  segments,
  active = 'all',
  onSelect,
}: {
  segments: TurnoverSegment[];
  active?: TurnoverSegmentKey;
  onSelect?: (key: TurnoverSegmentKey) => void;
}) {
  const [internal, setInternal] = useState<TurnoverSegmentKey>(active);
  const current = onSelect ? active : internal;
  const handle = (key: TurnoverSegmentKey) => {
    if (onSelect) onSelect(key);
    else setInternal(key);
  };

  return (
    <TooltipProvider delayDuration={150}>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {segments.map((s) => {
        const style = SEGMENT_STYLE[s.key];
        const Icon = style.icon;
        const isActive = current === s.key;
        return (
          <Card
            key={s.key}
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            className={cn(
              'cursor-pointer transition-shadow hover:shadow-md',
              isActive && `ring-2 ring-offset-2 ring-offset-background ${style.activeRing}`,
            )}
            onClick={() => handle(s.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handle(s.key);
              }
            }}
          >
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <span className={cn('inline-flex items-center gap-2 text-sm font-medium', style.tone)}>
                  <Icon className="size-4" />
                  {s.label}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center text-muted-foreground hover:text-foreground"
                        aria-label={`Описание сегмента «${s.label}»`}
                      >
                        <Info className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs leading-snug">
                      {SEGMENT_HINT[s.key]}
                    </TooltipContent>
                  </Tooltip>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{s.share.toFixed(s.share % 1 === 0 ? 0 : 2)}%</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatInt(s.count)}</span>
                <span className="text-sm text-muted-foreground">товаров</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full',
                    s.key === 'all' && 'bg-foreground/60',
                    s.key === 'stable' && 'bg-emerald-500',
                    s.key === 'medium' && 'bg-amber-500',
                    s.key === 'unstable' && 'bg-rose-500',
                  )}
                  style={{ width: `${s.share}%` }}
                />
              </div>
              <ul className="flex flex-col gap-1 pt-1 text-xs">
                <Stat label="Продажи, шт" value={`${formatInt(s.salesUnits)}`} />
                <Stat label="Продажи, ₽" value={formatRub(s.salesRevenue)} />
                <Stat label="Остаток, шт" value={formatInt(s.stockUnits)} />
                <Stat label="Избыточных" value={`${formatInt(s.excessCount)} тов.`} valueClass="text-amber-600 dark:text-amber-400" />
                <Stat
                  label="Закончились"
                  value={`${formatInt(s.outOfStockCount)} тов.`}
                  valueClass="text-rose-600 dark:text-rose-400"
                />
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
    </TooltipProvider>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium tabular-nums', valueClass)}>{value}</span>
    </li>
  );
}
