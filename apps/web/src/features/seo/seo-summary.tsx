import { AlertTriangle, ListChecks, ScanSearch, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { formatInt } from '@/shared/lib/format';
import type { SeoOverview } from '@/entities/seo';

export function SeoSummaryCards({ totals }: { totals: SeoOverview['totals'] }) {
  const share = totals.skuCount > 0 ? Math.round((totals.cleanCount / totals.skuCount) * 100) : 0;

  const items = [
    {
      icon: ScanSearch,
      label: 'Карточек проверено',
      value: `${formatInt(totals.skuCount)} SKU`,
      hint: `${formatInt(totals.issuesTotal)} замечаний всего`,
    },
    {
      icon: ShieldCheck,
      label: 'Без замечаний',
      value: `${formatInt(totals.cleanCount)} шт.`,
      hint: `${share}% каталога проходит проверку`,
    },
    {
      icon: AlertTriangle,
      label: 'Высокий риск',
      value: `${formatInt(totals.withRiskR)} карточек`,
      hint: `${formatInt(totals.viewsAtRisk)} просмотров за 30д приходится на них`,
    },
    {
      icon: ListChecks,
      label: 'Средний риск',
      value: `${formatInt(totals.withRiskA)} карточек`,
      hint: 'доводы против собственной карточки',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardContent className="flex items-start gap-3 p-5">
              <Icon className="text-muted-foreground size-5 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-sm">{item.label}</span>
                <span className="text-2xl font-semibold tracking-tight">{item.value}</span>
                <span className="text-muted-foreground text-xs">{item.hint}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
