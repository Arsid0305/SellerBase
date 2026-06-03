'use client';

import { Button } from '@/shared/ui/button';
import { Store } from 'lucide-react';

/**
 * MarketplaceFilter — мульти-селект WB / Ozon / Я.Маркет / МегаМаркет.
 * TODO: попап с чекбоксами, брендовые иконки, синхрон с URL через nuqs.
 */
export function MarketplaceFilter() {
  return (
    <Button variant="outline" size="sm" className="gap-2">
      <Store className="size-4" />
      <span>Все каналы</span>
    </Button>
  );
}
