'use client';

import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import type { TariffTabKey } from './types';

const TABS: { key: TariffTabKey; label: string }[] = [
  { key: 'wb-box', label: 'Базовые тарифы (WB)' },
  { key: 'wb-return', label: 'Возврат (WB)' },
  { key: 'wb-dynamics', label: 'Динамика коэф.' },
  { key: 'commission', label: 'Комиссии' },
  { key: 'logistics', label: 'Логистика (mock)' },
  { key: 'storage', label: 'Хранение' },
  { key: 'penalty', label: 'Штрафы' },
  { key: 'dimension', label: 'Габариты' },
];

export function TariffTabs({
  active,
  onSelect,
}: {
  active: TariffTabKey;
  onSelect: (key: TariffTabKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Button
            key={t.key}
            variant="outline"
            size="sm"
            onClick={() => onSelect(t.key)}
            className={cn(
              isActive && 'border-foreground/40 bg-accent text-foreground shadow-sm',
            )}
          >
            {t.label}
          </Button>
        );
      })}
    </div>
  );
}
