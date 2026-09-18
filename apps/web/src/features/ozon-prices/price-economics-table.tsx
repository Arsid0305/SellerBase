import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatInt, formatRub } from '@/shared/lib/format';
import type { OzonPriceRow } from '@/entities/ozon-prices';

/**
 * Сколько Ozon заберёт с продажи и что останется - по каждому товару.
 *
 * Числа не средние и не из отчётов задним числом: площадка отдаёт процент
 * комиссии и логистику в рублях по каждому товару отдельно, на сегодня.
 *
 * Логистика взята по нижней границе вилки, которую даёт Ozon (например
 * 63-169 ₽). Значит настоящая прибыль не больше показанной здесь, но может
 * быть меньше. Написано под таблицей, чтобы число не выглядело точнее, чем
 * оно есть.
 */
export function PriceEconomicsTable({ rows }: { rows: OzonPriceRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Цены и тарифы Ozon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Цены с площадки ещё не приходили.
        </CardContent>
      </Card>
    );
  }

  const srednyayaKomissiya =
    rows.reduce((s, r) => s + (r.commissionPct ?? 0), 0) / rows.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Цены и тарифы Ozon</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          {formatInt(rows.length)} товаров. Средняя комиссия площадки{' '}
          <span className="font-medium text-foreground">
            {srednyayaKomissiya.toFixed(1)} %
          </span>
          .
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-4 text-left font-medium">Артикул</th>
                <th className="py-2 pr-4 text-left font-medium">Товар</th>
                <th className="py-2 pr-4 text-right font-medium">Цена</th>
                <th className="py-2 pr-4 text-right font-medium">Комиссия</th>
                <th className="py-2 pr-4 text-right font-medium">Логистика</th>
                <th className="py-2 pr-4 text-right font-medium">Доставка</th>
                <th className="py-2 pr-4 text-right font-medium">Эквайринг</th>
                <th className="py-2 pr-4 text-right font-medium">Останется</th>
                <th className="py-2 pr-4 text-right font-medium">Себестоимость</th>
                <th className="py-2 pr-4 text-right font-medium">Прибыль</th>
                <th className="py-2 text-right font-medium">Маржа</th>
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
                    {r.commissionRub == null ? '-' : formatRub(r.commissionRub)}
                    {r.commissionPct != null && (
                      <span className="ml-1 text-xs">({r.commissionPct} %)</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                    {r.logistics == null ? '-' : formatRub(r.logistics)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                    {r.delivery == null ? '-' : formatRub(r.delivery)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                    {r.acquiring == null ? '-' : formatRub(r.acquiring)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {r.left == null ? '-' : formatRub(r.left)}
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
                  <td className="py-2 text-right tabular-nums">
                    {r.marginPct == null ? '-' : `${r.marginPct} %`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Логистика взята по нижней границе вилки, которую даёт Ozon. Настоящая
          прибыль не больше этой, но может быть меньше.
        </p>
      </CardContent>
    </Card>
  );
}
