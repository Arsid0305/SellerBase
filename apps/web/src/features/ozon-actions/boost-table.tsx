import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatInt, formatRub } from '@/shared/lib/format';
import type { OzonBoostRow } from '@/entities/ozon-prices';

/**
 * Цена против продвижения.
 *
 * Акция «эластичный бустинг» устроена так: продвижение зависит от того,
 * насколько продавец опустит цену. В кабинете Ozon видно цену и бустинг, но
 * не прибыль - а решает именно она.
 *
 * Поэтому здесь обе прибыли рядом: при нынешней акционной цене и при цене,
 * за которую дают максимальное продвижение. Правильного ответа нет: это
 * выбор «меньше с продажи, но чаще показывают», и зависит он от того,
 * упрётся ли товар в остаток.
 */
export function BoostTable({ rows }: { rows: OzonBoostRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Цена против продвижения</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Ни по одному товару поднять продвижение снижением цены сейчас нельзя:
          либо мы уже на максимуме, либо площадка такой вилки не даёт.
        </CardContent>
      </Card>
    );
  }

  const vMinus = rows.filter((r) => (r.profitAtMaxBoost ?? 0) < 0).length;
  const srednyayaPoterya =
    rows.reduce((s, r) => s + (r.lossPerUnit ?? 0), 0) / rows.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Цена против продвижения</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Поднять продвижение до максимума стоит в среднем{' '}
          <span className="font-medium text-foreground">
            {formatRub(srednyayaPoterya)}
          </span>{' '}
          с проданной штуки.{' '}
          {vMinus === 0 ? (
            <span className="text-emerald-600">
              В убыток при этом не уходит ни один товар.
            </span>
          ) : (
            <span className="text-destructive">
              {formatInt(vMinus)} {vMinus === 1 ? 'товар уйдёт' : 'товаров уйдут'} в
              убыток - их так ронять нельзя.
            </span>
          )}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-4 text-left font-medium">Артикул</th>
                <th className="py-2 pr-4 text-left font-medium">Товар</th>
                <th className="py-2 pr-4 text-right font-medium">Цена в акции</th>
                <th className="py-2 pr-4 text-right font-medium">Прибыль</th>
                <th className="py-2 pr-4 text-right font-medium">Цена за макс.</th>
                <th className="py-2 pr-4 text-right font-medium">Прибыль станет</th>
                <th className="py-2 pr-4 text-right font-medium">Потеряем</th>
                <th className="py-2 text-right font-medium">Продвижение</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.action}-${r.article}`} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono text-xs">{r.article}</td>
                  <td className="py-2 pr-4">{r.title ?? '-'}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {r.actionPrice == null ? '-' : formatRub(r.actionPrice)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {r.profitNow == null ? '-' : formatRub(r.profitNow)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {r.priceForMaxBoost == null ? '-' : formatRub(r.priceForMaxBoost)}
                  </td>
                  <td
                    className={
                      'py-2 pr-4 text-right tabular-nums ' +
                      ((r.profitAtMaxBoost ?? 0) < 0 ? 'text-destructive font-medium' : '')
                    }
                  >
                    {r.profitAtMaxBoost == null ? '-' : formatRub(r.profitAtMaxBoost)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                    {r.lossPerUnit == null ? '-' : formatRub(r.lossPerUnit)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {r.boostNow ?? '-'} → {r.boostMax ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
