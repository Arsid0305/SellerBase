import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';

export type ProductTagKind =
  | 'PPP' | 'PP' | 'P' | '-P'
  | 'A' | 'B' | 'C'
  | 'X' | 'Y' | 'Z'
  | 'FBO' | 'FBS';

const styles: Record<ProductTagKind, string> = {
  PPP: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  PP: 'border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-400',
  P: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  '-P': 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  A: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  B: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  C: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  X: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  Y: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  Z: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  FBO: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  FBS: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-400',
};

export function ProductTagBadge({ kind, className }: { kind: ProductTagKind; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-mono text-[10px] uppercase', styles[kind], className)}>
      {kind}
    </Badge>
  );
}
