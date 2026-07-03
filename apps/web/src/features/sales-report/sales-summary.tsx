import { ShoppingCart, Banknote, Receipt, XCircle, Ban } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { formatRub, formatInt } from '@/shared/lib/format';
import type { SalesSummary } from './types';

export function SalesSummaryCards({
  summary,
  cancelStats,
}: {
  summary: SalesSummary;
  cancelStats?: { totalOrders: number; cancelled: number; cancelRatePct: number };
}) {
  const items = [
    {
      icon: ShoppingCart,
      tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      label: 'Заказы',
      value: `${formatInt(summary.totalOrders)} шт.`,
      hint: `${formatInt(summary.totalUnits)} товаров`,
    },
    {
      icon: Banknote,
      tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      label: 'Выручка',
      value: formatRub(summary.totalRevenue),
      hint: 'всего за период',
    },
    {
      icon: Receipt,
      tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
      label: 'Средний чек',
      value: formatRub(summary.avgCheck),
      hint: 'на один заказ',
    },
    {
      icon: XCircle,
      tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      label: 'Возвраты',
      value: `${summary.cancellationRate.toFixed(1)}%`,
      hint: 'доля возвратов от выкупленных',
    },
  ];

  if (cancelStats && cancelStats.totalOrders > 0) {
    items.push({
      icon: Ban,
      tone: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      label: 'Отменено заказов',
      value: `${cancelStats.cancelRatePct.toFixed(1)}%`,
      hint: `${formatInt(cancelStats.cancelled)} из ${formatInt(cancelStats.totalOrders)} (wb_orders_fact)`,
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
