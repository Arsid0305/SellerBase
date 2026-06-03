import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';

export type CategoryTone = 'amber' | 'rose' | 'emerald' | 'sky' | 'violet' | 'neutral';

const TONE_ICON: Record<CategoryTone, string> = {
  amber: 'text-amber-600 dark:text-amber-400',
  rose: 'text-rose-600 dark:text-rose-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  sky: 'text-sky-600 dark:text-sky-400',
  violet: 'text-violet-600 dark:text-violet-400',
  neutral: 'text-muted-foreground',
};

/**
 * Чистый enterprise-стиль: без цветных top-border'ов и заглавных заголовков.
 * Только тонкий цветовой акцент на иконке для визуальной разметки секций.
 * Linear / Stripe Dashboard / Mercury стиль.
 */
export function CategoryCard({
  title,
  tone = 'neutral',
  icon: Icon,
  children,
  className,
  action,
}: {
  title: string;
  tone?: CategoryTone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            {Icon && <Icon className={cn('size-4', TONE_ICON[tone])} />}
            {title}
          </span>
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="pt-1">{children}</CardContent>
    </Card>
  );
}

export type StatRow = {
  label: string;
  value: React.ReactNode;
  tone?: 'positive' | 'negative' | 'muted';
  hint?: string;
};

export function StatList({ rows }: { rows: StatRow[] }) {
  return (
    <dl className="flex flex-col divide-y divide-border/60">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-4 py-2 text-sm">
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd
            className={cn(
              'text-right tabular-nums font-medium',
              r.tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
              r.tone === 'negative' && 'text-rose-600 dark:text-rose-400',
              r.tone === 'muted' && 'text-muted-foreground font-normal',
            )}
          >
            {r.value}
            {r.hint && <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">{r.hint}</div>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
