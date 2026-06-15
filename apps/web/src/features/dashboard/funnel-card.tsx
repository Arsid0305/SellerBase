import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/card';
import type { SellerAnalytics } from '@/entities/seller-analytics';

type FunnelProps = { funnel: SellerAnalytics['funnel'] };

function fmtPct(v: number): string {
  return `${v.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
}

export function FunnelCard({ funnel }: FunnelProps) {
  const items = [
    { label: 'Конверсия в корзину', value: funnel.addToCartPct },
    { label: 'Конверсия в заказ', value: funnel.cartToOrderPct },
    { label: '% выкупа', value: funnel.buyoutPct },
  ];

  return (
    <Card className="p-4">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="text-sm font-medium">
          Аналитика продавца — Воронка продаж
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-3 gap-3">
          {items.map((it) => (
            <div key={it.label} className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{it.label}</span>
              <span className="text-lg font-semibold tabular-nums">{fmtPct(it.value)}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">за {funnel.periodDays} дней</p>
      </CardContent>
    </Card>
  );
}
