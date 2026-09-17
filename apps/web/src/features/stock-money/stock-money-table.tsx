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
 * Итог считаем здесь, а не в базе: «Потеряно» - это списание, товара уже
 * нет, и складывать его с наличным остатком в одну сумму нельзя. Поэтому
 * две итоговые строки, а не одна.
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

  const naliche = rows
    .filter((r) => r.kind === 'itog' && r.label !== 'Потеряно')
    .reduce((acc, r) => ({ units: acc.units + r.units, rub: acc.rub + r.rub }), { units: 0, rub: 0 });
  const poteryano = rows.find((r) => r.label === 'Потеряно');
  const vProdazhe = rows.find((r) => r.label === 'Лежит для продажи');
  const dolyaRabotaet = naliche.rub > 0 && vProdazhe
    ? Math.round((vProdazhe.rub / naliche.rub) * 100)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Где деньги</CardTitle>
      </CardHeader>
      <CardContent>
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
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="py-2 pr-4">Товара в наличии</td>
                <td className="py-2 pr-4 text-right tabular-nums">{formatInt(naliche.units)}</td>
                <td className="py-2 text-right tabular-nums">{formatRub(naliche.rub)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          {dolyaRabotaet != null && (
            <>
              Из {formatRub(naliche.rub)} товара работает {formatRub(vProdazhe?.rub ?? 0)} -
              это {dolyaRabotaet} %. Остальное лежит мёртво.{' '}
            </>
          )}
          {poteryano && poteryano.units > 0 && (
            <>
              Плюс {formatRub(poteryano.rub)} списано - этого товара уже нет физически, в
              наличие он не входит.
            </>
          )}
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
