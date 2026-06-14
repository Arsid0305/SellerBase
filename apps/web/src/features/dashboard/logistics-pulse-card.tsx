import { Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { TooltipIcon } from '@/shared/ui/tooltip-icon';
import { cn } from '@/shared/lib/utils';
import type { WbAverageWarehouseCoef } from '@/entities/wb-tariffs';

const PULSE_TOOLTIP =
  'Средний коэффициент склада WB, взвешенный по твоим остаткам. 1,00 = базовая ставка хранения и доставки. 1,42 значит, что в среднем твои товары лежат на складах с надбавкой +42% к базе. Меньше — выгоднее.';

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
          <CardTitle className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
            Логистический пульс
            <TooltipIcon text={PULSE_TOOLTIP} />
          </CardTitle>
          <Truck className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Данных по тарифам или остаткам пока нет.
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

  const fmtCoef = (n: number) => (n / 100).toFixed(2).replace('.', ',');
  const fmtDelta = (n: number) => {
    const v = n / 100;
    const s = v.toFixed(2).replace('.', ',');
    return v >= 0 ? `+${s}` : s;
  };
  const fmtUnits = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
          Логистический пульс
          <TooltipIcon text={PULSE_TOOLTIP} />
        </CardTitle>
        <Truck className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold tabular-nums">{fmtCoef(current.coef)}</span>
            <span className="text-sm text-muted-foreground">× базовой ставки</span>
            {delta !== null && (
              <span className={cn('text-sm font-medium', tone)}>
                {fmtDelta(delta)} vs неделя назад
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Усреднено по {current.warehouseCount} складам с твоими остатками.
            {delta !== null && (delta < 0
              ? ' Доставка дешевеет.'
              : delta > 0
                ? ' Доставка дорожает.'
                : '')}
          </p>
        </div>

        {current.warehouses && current.warehouses.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Склад</th>
                  <th className="px-3 py-2 text-right font-medium">Коэф.</th>
                  <th className="px-3 py-2 text-right font-medium">Остаток</th>
                  <th className="px-3 py-2 text-right font-medium">Доля</th>
                </tr>
              </thead>
              <tbody>
                {current.warehouses.map((w) => {
                  const coefTone =
                    w.coef >= 150
                      ? 'text-rose-600 dark:text-rose-400'
                      : w.coef >= 120
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400';
                  return (
                    <tr key={w.warehouseName} className="border-t border-border">
                      <td className="px-3 py-1.5">{w.warehouseName}</td>
                      <td className={cn('px-3 py-1.5 text-right font-medium tabular-nums', coefTone)}>
                        {fmtCoef(w.coef)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtUnits(w.units)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {w.sharePct.toFixed(1).replace('.', ',')}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
