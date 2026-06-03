'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/utils';

export type ProductTabKey = 'summary' | 'days' | 'weeks' | 'categories' | 'queries' | 'regions';

const TABS: { key: ProductTabKey; label: string }[] = [
  { key: 'summary', label: 'Сводка' },
  { key: 'days', label: 'По дням' },
  { key: 'weeks', label: 'По неделям' },
  { key: 'categories', label: 'Категории' },
  { key: 'queries', label: 'Поисковые запросы' },
  { key: 'regions', label: 'По регионам' },
];

export function ProductTabs({
  initial = 'summary',
  onChange,
}: {
  initial?: ProductTabKey;
  onChange?: (k: ProductTabKey) => void;
}) {
  const [active, setActive] = useState<ProductTabKey>(initial);
  const handle = (k: ProductTabKey) => {
    setActive(k);
    onChange?.(k);
  };
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => handle(t.key)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
              isActive
                ? 'border-foreground text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
