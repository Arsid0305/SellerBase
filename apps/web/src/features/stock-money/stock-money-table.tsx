import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatInt, formatRub } from '@/shared/lib/format';
import type { StockMoneyRow } from '@/entities/stock-money';
import { cn } from '@/shared/lib/utils';

/**
 * «Где мои деньги» - остатки в рублях по себестоимости.
 *
 * Просьба владелицы 17.09.2026, дословно: «вот прям такую сотку хочу
 * где-то видеть текущую». Поэтому строки, их порядок и названия - как в
 * её таблице, без переделок под удобство вёрстки.
 *
 * Главное число - «в работе», и только оно. Сначала здесь стоял общий итог
 * «товара в наличии» с долей «работает 19 %». Владелица это отменила:
 * «скорее всего этого никогда не вернут, то что потеряно или то что
 * зависло. Постоянно видеть эту цифру наверно не. На данный момент реально
 * работает столько, да и уже отталкиваться. Я не питаю иллюзий».
 *
 * Она права и по сути: общий итог складывал живой товар с деньгами, которых
 * уже нет, и получалась сумма, на которую нельзя опереться ни в одном
 * решении. Мёртвое показываем строками - видеть надо, планировать от него
 * нельзя.
 */
export function StockMoneyTable({ rows }: { rows: StockMoneyRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Где деньги</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Нет данных об остатках. Проверить сбор остатков ВБ.
        </CardContent>
      </Card>
    );
  }

  const byLabel = (label: string) => rows.find((r) => r.label === label);
  const vRabote = byLabel('Лежит для продажи');
  const zamorozheno = byLabel('Заморожено на мёртвых складах');
  const zavislo = byLabel('Возвраты, зависли');
  const poteryano = byLabel('Потеряно');
  // Мёртвое - это заморожённое и зависшее. «Едет покупателям» сюда не идёт:
  // тот товар в процессе, он почти продан.
  const mertvoe = (zamorozheno?.rub ?? 0) + (zavislo?.rub ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Где деньги</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-5">
          <div className="text-xs text-muted-foreground">В работе</div>
          <div className="text-3xl font-semibold tabular-nums">
            {formatRub(vRabote?.rub ?? 0)}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatInt(vRabote?.units ?? 0)} шт · это то, что лежит и продаётся
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Что</th>
                <th className="py-2 pr-4 text-right font-medium">Штук</th>
                <th className="py-2 text-right font-medium">Денег</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.order}
                  className={cn(
                    'border-b last:border-0',
                    r.kind === 'itog' && 'font-semibold',
                    r.label === 'Потеряно' && 'text-destructive',
                  )}
                >
                  <td className="py-2 pr-4">
                    <span className={r.kind === 'stroka' ? 'pl-4 text-muted-foreground' : undefined}>
                      {r.kind === 'stroka' ? `— ${r.label}` : r.label}
                    </span>
                    {r.note && (
                      <span className="block pl-4 text-xs font-normal text-muted-foreground">
                        {r.note}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatInt(r.units)}</td>
                  <td className="py-2 text-right tabular-nums">{formatRub(r.rub)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Мёртвым лежит {formatRub(mertvoe)}
          {poteryano && poteryano.units > 0 && <> и {formatRub(poteryano.rub)} списано</>}. Общей
          суммой с работающим товаром это не складываем: опираться на такую сумму нельзя.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          · Всё по себестоимости. «Потеряно» - то, что ушло со склада без продажи и без
          отправки покупателю. Часть этой цифры может оказаться задержкой отчёта ВБ, она
          уточняется со следующим отчётом.
        </p>
      </CardContent>
    </Card>
  );
}
