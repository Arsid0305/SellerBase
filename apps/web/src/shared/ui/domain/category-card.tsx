import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';

export type CategoryTone = 'amber' | 'rose' | 'emerald' | 'sky' | 'violet' | 'neutral';

const TONE_TOP: Record<CategoryTone, string> = {
  amber: 'border-t-amber-500',
  rose: 'border-t-rose-500',
  emerald: 'border-t-emerald-500',
  sky: 'border-t-sky-500',
  violet: 'border-t-violet-500',
  neutral: 'border-t-slate-400',
};

const TONE_TEXT: Record<CategoryTone, string> = {
  amber: 'text-amber-700 dark:text-amber-300',
  rose: 'text-rose-700 dark:text-rose-300',
  emerald: 'text-emerald-700 dark:text-emerald-300',
  sky: 'text-sky-700 dark:text-sky-300',
  violet: 'text-violet-700 dark:text-violet-300',
  neutral: 'text-foreground',
};

export function CategoryCard({
  title,
  tone,
  icon: Icon,
  children,
  className,
  action,
}: {
  title: string;
  tone: CategoryTone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className={cn('overflow-hidden border-t-4', TONE_TOP[tone], className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={cn('text-sm font-semibold uppercase tracking-wider', TONE_TEXT[tone])}>
          <span className="inline-flex items-center gap-1.5">
            {Icon && <Icon className="size-4" />}
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
    <dl className="flex flex-col divide-y divide-border">
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
