'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

/**
 * Переключатель площадок в разделе: ВБ или Ozon.
 *
 * Решение владелицы 18.09.2026: новых пунктов меню под Ozon не заводить -
 * это тот же разговор, просто про вторую площадку. Содержимое приходит с
 * сервера готовым, здесь только переключение.
 *
 * ВБ открыт по умолчанию: на нём больше оборота.
 */
export function PlatformTabs({
  wb,
  ozon,
  ozonBadge,
}: {
  wb: React.ReactNode;
  ozon: React.ReactNode;
  ozonBadge?: number;
}) {
  const [tab, setTab] = useState<'wb' | 'ozon'>('wb');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTab('wb')}
          className={cn(tab === 'wb' && 'border-foreground/40 bg-accent text-foreground shadow-sm')}
        >
          Wildberries
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTab('ozon')}
          className={cn(tab === 'ozon' && 'border-foreground/40 bg-accent text-foreground shadow-sm')}
        >
          Ozon
          {ozonBadge != null && ozonBadge > 0 && (
            <span className="ml-1 rounded bg-destructive/10 px-1.5 text-[11px] font-medium text-destructive">
              {ozonBadge}
            </span>
          )}
        </Button>
      </div>

      <div className={tab === 'wb' ? '' : 'hidden'}>{wb}</div>
      <div className={tab === 'ozon' ? '' : 'hidden'}>{ozon}</div>
    </div>
  );
}
