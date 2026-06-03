'use client';

import { Check, Store } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { useFiltersStore, type MarketplaceKey } from '@/shared/stores/filters';

const CHANNELS: { key: MarketplaceKey; label: string; dotClass: string }[] = [
  { key: 'WB', label: 'Wildberries', dotClass: 'bg-fuchsia-500' },
  { key: 'OZON', label: 'Ozon', dotClass: 'bg-sky-500' },
];

export function MarketplaceFilter() {
  const marketplaces = useFiltersStore((s) => s.marketplaces);
  const toggle = useFiltersStore((s) => s.toggleMarketplace);

  const label =
    marketplaces.length === CHANNELS.length
      ? 'Все каналы'
      : marketplaces.map((m) => CHANNELS.find((c) => c.key === m)?.label).filter(Boolean).join(', ');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Store className="size-4" />
          <span>{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-2">
        <div className="px-2 pb-1 pt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          Каналы продаж
        </div>
        {CHANNELS.map((c) => {
          const selected = marketplaces.includes(c.key);
          return (
            <DropdownMenuItem
              key={c.key}
              onSelect={(event) => {
                event.preventDefault();
                toggle(c.key);
              }}
              className="flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <span className={cn('size-2.5 rounded-full', c.dotClass)} />
                <span className={selected ? 'font-medium' : 'text-muted-foreground'}>{c.label}</span>
              </span>
              {selected && <Check className="size-3.5" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
