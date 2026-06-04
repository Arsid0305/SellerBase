import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import { LIFECYCLE_META, type LifecycleMeta, type ProductLifecycleState } from '@/entities/product-state/types';

type Tone = LifecycleMeta['tone'];

const TONE_CLASS: Record<Tone, string> = {
  emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  rose: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  sky: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  violet: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-400',
  neutral: 'border-border bg-muted/50 text-muted-foreground',
};

export function LifecycleBadge({
  state,
  showDescription,
  className,
}: {
  state: ProductLifecycleState;
  showDescription?: boolean;
  className?: string;
}) {
  const meta = LIFECYCLE_META[state];
  return (
    <Badge
      variant="outline"
      className={cn('font-medium text-[10px] uppercase tracking-wider', TONE_CLASS[meta.tone], className)}
      title={showDescription ? meta.description : undefined}
    >
      {meta.label}
    </Badge>
  );
}
