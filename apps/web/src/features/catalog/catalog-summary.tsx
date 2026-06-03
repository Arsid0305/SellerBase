import { Boxes, ShieldCheck, AlertCircle, Activity } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { formatRub, formatInt } from '@/shared/lib/format';
import type { CatalogSummary } from './types';

export function CatalogSummaryCards({ summary }: { summary: CatalogSummary }) {
  const items = [
    {
      icon: Boxes,
      label: 'Всего SKU',
      value: `${formatInt(summary.totalCount)} товаров`,
      hint: `${formatInt(summary.inStock)} в наличии · ${formatInt(summary.outOfStock)} закончились`,
    },
    {
      icon: ShieldCheck,
      label: 'Продажи за 30 дней',
      value: formatRub(summary.totalSales30dRub),
      hint: `ср. маржа ${summary.avgMargin.toFixed(1)}%`,
    },
    {
      icon: AlertCircle,
      label: 'Без продаж 30д',
      value: `${formatInt(summary.noSales30d)} тов.`,
      hint: 'или ни одной продажи',
    },
    {
      icon: Activity,
      label: 'Избыточный сток',
      value: `${formatInt(summary.excessCount)} тов.`,
      hint: 'хватит больше 90 дней',
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
