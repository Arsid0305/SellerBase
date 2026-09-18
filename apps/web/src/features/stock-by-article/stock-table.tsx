import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { StockByArticleRow } from '@/entities/stock-by-article';

/**
 * Остатки по артикулам на обеих площадках.
 *
 * Одна таблица с прокруткой вбок, а не две по пять колонок: остаток и
 * оборачиваемость смотрят вместе, разносить их по вкладкам неудобно.
 * Решение владелицы 17.09.2026.
 *
 * Пустая клетка в днях - продаж не было. Именно пусто, а не ноль и не
 * прочерк со звёздочкой: ноль дней читается как «кончится завтра», а на
 * деле товар не продаётся вовсе. Правило владелицы: «если не было продаж
 * просто пишешь не было продаж».
 */
function Dney({ value, sales }: { value: number | null; sales: number }) {
  if (value == null) {
    return <span className="text-xs text-muted-foreground">нет продаж</span>;
  }
  return (
    <span
      className={cn('tabular-nums', value > 180 && 'font-medium text-destructive')}
      title={`${formatInt(sales)} шт за 28 дней`}
    >
      {formatInt(value)}
    </span>
  );
}

export function StockByArticleTable({ rows }: { rows: StockByArticleRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Остатки по артикулам</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Нет данных об остатках. Проверить сбор остатков ВБ и Ozon.
        </CardContent>
      </Card>
    );
  }

  const itog = rows.reduce(
    (a, r) => ({
      wbFbo: a.wbFbo + r.wbFbo,
      ozonFbo: a.ozonFbo + r.ozonFbo,
      fbs: a.fbs + r.fbs,
      total: a.total + r.total,
      dead: a.dead + r.dead,
    }),
    { wbFbo: 0, ozonFbo: 0, fbs: 0, total: 0, dead: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Остатки по артикулам</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-4 text-left font-medium">Артикул</th>
                <th className="py-2 pr-4 text-left font-medium">Товар</th>
                <th className="py-2 pr-3 text-right font-medium">ВБ</th>
                <th className="py-2 pr-3 text-right font-medium">Ozon</th>
                <th className="py-2 pr-3 text-right font-medium">ФБС</th>
                <th className="py-2 pr-4 text-right font-medium">Итого</th>
                <th className="py-2 pr-4 text-right font-medium">Мёртвое</th>
                <th className="py-2 pr-3 text-right font-medium">Дней ВБ</th>
                <th className="py-2 pr-3 text-right font-medium">Дней Ozon</th>
                <th className="py-2 text-right font-medium">Дней всего</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.article} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium whitespace-nowrap">{r.article}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{r.title ?? '—'}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatInt(r.wbFbo)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatInt(r.ozonFbo)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatInt(r.fbs)}</td>
                  <td className="py-2 pr-4 text-right font-medium tabular-nums">
                    {formatInt(r.total)}
                  </td>
                  <td
                    className={cn(
                      'py-2 pr-4 text-right tabular-nums',
                      r.dead > 0 && 'text-destructive',
                    )}
                  >
                    {r.dead > 0 ? formatInt(r.dead) : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <Dney value={r.daysWb} sales={r.salesWb28} />
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <Dney value={r.daysOzon} sales={r.salesOzon28} />
                  </td>
                  <td className="py-2 text-right">
                    <Dney value={r.daysTotal} sales={r.salesWb28 + r.salesOzon28} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="py-2 pr-4" colSpan={2}>
                  Итого, {formatInt(rows.length)} артикулов
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatInt(itog.wbFbo)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatInt(itog.ozonFbo)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatInt(itog.fbs)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{formatInt(itog.total)}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-destructive">
                  {formatInt(itog.dead)}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          · «ФБС» - фулфилмент, одно число: товар заявляется обеим площадкам одинаково.
          «Мёртвое» - замороженное и зависшее, в оборачиваемость не входит: оно не
          продаётся. Дни считаются по продажам за 28 дней; где продаж не было, так и
          написано.
        </p>
      </CardContent>
    </Card>
  );
}
