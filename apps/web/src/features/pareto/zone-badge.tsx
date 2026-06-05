import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { ParetoZone } from '@/entities/pareto';

const ZONE_CLASS: Record<ParetoZone, string> = {
  A: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  B: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  C: 'border-border bg-muted/50 text-muted-foreground',
};

const ZONE_TITLE: Record<ParetoZone, string> = {
  A: 'Зона A — топ ≈80% выручки, приоритет управления',
  B: 'Зона B — средние 80–95% выручки',
  C: 'Зона C — длинный хвост, 95–100%',
};

export function ZoneBadge({ zone, className }: { zone: ParetoZone; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('font-medium text-[10px] uppercase tracking-wider', ZONE_CLASS[zone], className)}
      title={ZONE_TITLE[zone]}
    >
      {zone}
    </Badge>
  );
}
