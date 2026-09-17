'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

/**
 * Две вкладки в одном разделе: оборачиваемость и дефицит.
 * Решение владелицы 17.09.2026: «Дефицит товаров» отдельным пунктом меню не
 * держим - это тот же разговор про запас, только с другой стороны.
 * Содержимое приходит с сервера готовым, здесь только переключатель.
 */
export function TurnoverTabs({
  turnover,
  deficit,
  deficitCount,
}: {
  turnover: React.ReactNode;
  deficit: React.ReactNode;
  deficitCount: number;
}) {
  const [tab, setTab] = useState<'turnover' | 'deficit'>('turnover');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTab('turnover')}
          className={cn(tab === 'turnover' && 'border-foreground/40 bg-accent text-foreground shadow-sm')}
        >
          Оборачиваемость
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTab('deficit')}
          className={cn(tab === 'deficit' && 'border-foreground/40 bg-accent text-foreground shadow-sm')}
        >
          Что заканчивается
          {deficitCount > 0 && (
            <span className="ml-1 rounded bg-destructive/10 px-1.5 text-[11px] font-medium text-destructive">
              {deficitCount}
            </span>
          )}
        </Button>
      </div>

      <div className={tab === 'turnover' ? '' : 'hidden'}>{turnover}</div>
      <div className={tab === 'deficit' ? '' : 'hidden'}>{deficit}</div>
    </div>
  );
}
