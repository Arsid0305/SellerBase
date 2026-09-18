import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { FbsMismatchRow } from '@/entities/stock-by-article';

/**
 * Остаток на фулфилменте - что заявлено каждой площадке.
 *
 * Раньше здесь была таблица ручного ввода: остатки вписывались руками. Её
 * ни разу не заполнили, и владелица 18.09.2026 увидела то, что и должна
 * была: «просто сейчас там нули».
 *
 * Теперь числа приходят с самих площадок дважды в день. Ручной ввод убран
 * не только как ненужный, но и как вредный: вписанное руками противоречило
 * бы тому, что площадки знают на самом деле.
 *
 * Две колонки, а не одна, хотя товар лежит одной кучей. Разница между ними
 * и есть смысл этой страницы: 18.09 на Ozon было заявлено 1 585 штук, а на
 * ВБ ноль - полсотни артикулов продавались на одной площадке из двух.
 */
export function FbsStockTable({ rows }: { rows: FbsMismatchRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Что лежит на фулфилменте</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Ни одной площадке ничего не заявлено. Так бывает сразу после отгрузки на
          фулфилмент: товар приехал, но площадки о нём ещё не знают.
        </CardContent>
      </Card>
    );
  }

  const itog = rows.reduce(
    (a, r) => ({ wb: a.wb + r.declaredWb, ozon: a.ozon + r.declaredOzon }),
    { wb: 0, ozon: 0 },
  );
  const rashozhdeniya = rows.filter((r) => r.diff !== 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Что лежит на фулфилменте</CardTitle>
      </CardHeader>
      <CardContent>
        {rashozhdeniya.length > 0 ? (
          <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <span className="font-medium text-destructive">
              Площадки расходятся: {formatInt(rashozhdeniya.length)}{' '}
              {rashozhdeniya.length === 1 ? 'артикул' : 'артикулов'}
            </span>{' '}
            <span className="text-muted-foreground">
              Товар один, а заявлено разное. Где число меньше - там он лежит и не
              продаётся.
            </span>
          </p>
        ) : (
          <p className="mb-4 text-sm text-emerald-600">
            Обе площадки знают одно и то же. Расхождений нет.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-4 text-left font-medium">Артикул</th>
                <th className="py-2 pr-4 text-left font-medium">Товар</th>
                <th className="py-2 pr-4 text-right font-medium">Заявлено ВБ</th>
                <th className="py-2 pr-4 text-right font-medium">Заявлено Ozon</th>
                <th className="py-2 text-left font-medium">Состояние</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.article} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium whitespace-nowrap">{r.article}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{r.title ?? '—'}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatInt(r.declaredWb)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatInt(r.declaredOzon)}
                  </td>
                  <td
                    className={cn(
                      'py-2 text-xs',
                      r.diff === 0 ? 'text-muted-foreground' : 'text-destructive',
                    )}
                  >
                    {r.diff === 0 ? 'Сходится' : `${r.state}, на ${formatInt(Math.abs(r.diff))} шт`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="py-2 pr-4" colSpan={2}>
                  Итого, {formatInt(rows.length)} артикулов
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">{formatInt(itog.wb)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{formatInt(itog.ozon)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          · Товар на фулфилменте лежит одной кучей - складывать две колонки нельзя, это
          одно и то же. Числа приходят с площадок дважды в день, вручную ничего вводить
          не нужно.
        </p>
      </CardContent>
    </Card>
  );
}
