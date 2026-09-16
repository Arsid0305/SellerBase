import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { TariffMarketplace } from './types';

export function MarketplaceBadge({ marketplace }: { marketplace: TariffMarketplace }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono text-[10px]',
        marketplace === 'WB' && 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400',
        marketplace === 'OZON' && 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
      )}
    >
      {marketplace}
    </Badge>
  );
}

export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime();
  return Math.max(0, Math.floor((now.getTime() - then) / (1000 * 60 * 60 * 24)));
}
