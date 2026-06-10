import { Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';
import type { WbAverageWarehouseCoef } from '@/entities/wb-tariffs';

export function LogisticsPulseCard({
  current,
  previous,
}: {
  current: WbAverageWarehouseCoef | null;
  previous: WbAverageWarehouseCoef | null;
}) {
  if (!current || current.coef === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Логистический пульс
          </CardTitle>
          <Truck className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Данных по тарифам или остаткам пока нет — пульс появится после первого фетча.
          </p>
        </CardContent>
      </Card>
    );
  }

  const delta = previous && previous.coef > 0 ? current.coef - previous.coef : null;
  const tone =
    delta === null
      ? 'text-muted-foreground'
      : delta < 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : delta > 0
          ? 'text-rose-600 dark:text-rose-400'
          : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Логистический пульс
        </CardTitle>
        <Truck className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-semibold tabular-nums">{current.coef.toFixed(2)}</span>
          {delta !== null && (
            <span className={cn('text-sm font-medium', tone)}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(2)} vs неделя назад
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Средний коэф. склада, взвешенный по остаткам ({current.warehouseCount} складов).
          {delta !== null && (delta < 0
            ? ' Доставка дешевеет.'
            : delta > 0
              ? ' Доставка дорожает.'
              : '')}
        </p>
      </CardContent>
    </Card>
  );
}
