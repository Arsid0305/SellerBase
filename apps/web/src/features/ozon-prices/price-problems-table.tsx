import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatInt, formatRub } from '@/shared/lib/format';
import type { OzonPriceProblemRow } from '@/entities/ozon-prices';

/**
 * Где цена Ozon работает против нас.
 *
 * Первым экраном именно это, решение владелицы 18.09.2026: открыла и сразу
 * видно, что чинить, а не полный список из шести десятков строк, в котором
 * проблемы надо искать глазами.
 *
 * Индекс цены - отдельная история. Ozon сравнивает нашу цену с ценами тех же
 * товаров на других площадках и за высокую цену показывает товар хуже. Но
 * комиссия Ozon вдвое выше комиссии ВБ, поэтому одну и ту же маржу Ozon даёт
 * только при цене выше. Снять индекс и сохранить маржу одновременно нельзя,
 * и выбор тут не технический.
 */
export function PriceProblemsTable({ rows }: { rows: OzonPriceProblemRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Где цена работает против нас</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-emerald-600">
          Ни одного товара с проблемной ценой. Убытка нет, маржа везде выше 10 %,
          индекс цены нигде не красный.
        </CardContent>
      </Card>
    );
  }

  const ubytok = rows.filter((r) => (r.profit ?? 0) < 0).length;
  const krasnyy = rows.filter((r) => r.indexColor === 'RED').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Где цена работает против нас</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          {ubytok > 0 && (
            <span className="font-medium text-destructive">
              В убыток {formatInt(ubytok)}{' '}
              {ubytok === 1 ? 'товар' : 'товаров'}.{' '}
            </span>
          )}
          {krasnyy > 0 && (
            <>
              Красный индекс у {formatInt(krasnyy)}{' '}
              {krasnyy === 1 ? 'товара' : 'товаров'} - Ozon считает цену завышенной
              и показывает их хуже.
            </>
          )}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-4 text-left font-medium">Артикул</th>
                <th className="py-2 pr-4 text-left font-medium">Товар</th>
                <th className="py-2 pr-4 text-right font-medium">Цена</th>
                <th className="py-2 pr-4 text-right font-medium">Себестоимость</th>
                <th className="py-2 pr-4 text-right font-medium">Прибыль</th>
                <th className="py-2 pr-4 text-right font-medium">Маржа</th>
                <th className="py-2 text-left font-medium">Что не так</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.article} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono text-xs">{r.article}</td>
                  <td className="py-2 pr-4">{r.title ?? '-'}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatRub(r.price)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                    {r.costPrice == null ? '-' : formatRub(r.costPrice)}
                  </td>
                  <td
                    className={
                      'py-2 pr-4 text-right tabular-nums ' +
                      ((r.profit ?? 0) < 0 ? 'text-destructive font-medium' : '')
                    }
                  >
                    {r.profit == null ? '-' : formatRub(r.profit)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {r.marginPct == null ? '-' : `${r.marginPct} %`}
                  </td>
                  <td className="py-2 text-muted-foreground">{r.problem ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
