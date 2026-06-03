import { Boxes, BadgeCheck, AlertOctagon, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { formatInt } from '@/shared/lib/format';
import type { AnalyticsSummary } from './types';

export function AnalyticsSummaryCards({ summary }: { summary: AnalyticsSummary }) {
  const items = [
    {
      icon: Boxes,
      tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      label: 'Всего товаров',
      value: `${formatInt(summary.totalProducts)} шт.`,
      hint: 'в анализе за период',
    },
    {
      icon: ShieldCheck,
      tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      label: 'С себестоимостью',
      value: `${formatInt(summary.withCost)} шт.`,
      hint: summary.withoutCost === 0 ? 'все товары' : `без себестоимости: ${summary.withoutCost}`,
    },
    {
      icon: BadgeCheck,
      tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      label: 'Стабильные',
      value: `${formatInt(summary.stable)} шт.`,
      hint: 'XYZ = X',
    },
    {
      icon: AlertOctagon,
      tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      label: 'Нестабильные',
      value: `${formatInt(summary.unstable)} шт.`,
      hint: 'XYZ = Z',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardContent className="flex items-start gap-3 p-5">
              <div className={`rounded-md p-2 ${item.tone}`}>
                <Icon className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-2xl font-semibold tracking-tight">{item.value}</span>
                <span className="text-xs text-muted-foreground">{item.hint}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
