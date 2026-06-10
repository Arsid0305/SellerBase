import { Warehouse, ShoppingCart, Banknote, Crown } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { formatRub, formatInt } from '@/shared/lib/format';
import type { SourcesSummary } from '@/entities/sources';

export function SourcesSummaryCards({ summary }: { summary: SourcesSummary }) {
  const items = [
    {
      icon: ShoppingCart,
      label: 'Всего заказов',
      value: `${formatInt(summary.totalOrders)} шт.`,
      hint: `выручка ${formatRub(summary.totalRevenue)}`,
    },
    {
      icon: Banknote,
      label: 'Средний чек',
      value: formatRub(summary.avgCheck),
      hint: 'revenue / orders',
    },
    {
      icon: Warehouse,
      label: 'Склады WB',
      value: `${formatInt(summary.uniqueWarehouses)} шт.`,
      hint: 'уникальных источников',
    },
    {
      icon: Crown,
      label: 'Топ склад',
      value: summary.topWarehouse.name,
      hint: `${summary.topWarehouse.share.toFixed(1)}% · ${formatRub(summary.topWarehouse.revenue)}`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardContent className="flex items-start gap-3 p-5">
              <Icon className="size-5 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="truncate text-2xl font-semibold tracking-tight">{item.value}</span>
                <span className="text-xs text-muted-foreground">{item.hint}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
