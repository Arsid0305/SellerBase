import { AlertTriangle } from 'lucide-react';
import { formatInt } from '@/shared/lib/format';
import type { FbsMismatchRow } from '@/entities/stock-by-article';

/**
 * Тревога о расхождении ФБС.
 *
 * Владелица 17.09.2026: «остатки на складах ФБС ВБ = остатки на FBS ozon =
 * остатки ФБС на фулфилменте». Одна куча, заявленная обеим площадкам.
 * Значит расхождение - не два разных остатка, а рассинхрон: на площадке с
 * меньшим числом товар лежит, но не продаётся.
 *
 * Это не столбец в широкой таблице, а отдельная строка сверху: такое надо
 * увидеть, а не найти. Когда всё сходится - строки нет совсем, иначе
 * предупреждение примелькается и перестанет работать.
 */
export function FbsAlert({ rows }: { rows: FbsMismatchRow[] }) {
  if (rows.length === 0) return null;

  const poteryano = rows.reduce((acc, r) => acc + Math.abs(r.diff), 0);
  const menshe_na_ozon = rows.filter((r) => r.declaredOzon < r.declaredWb).length;

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="flex flex-col gap-2">
          <div className="font-semibold text-destructive">
            ФБС разошёлся: {formatInt(rows.length)}{' '}
            {rows.length === 1 ? 'артикул' : 'артикулов'}, {formatInt(poteryano)} шт
          </div>
          <p className="text-sm text-muted-foreground">
            Товар на фулфилменте один, а площадкам заявлено разное. Там, где число меньше,
            товар лежит, но не продаётся.
            {menshe_na_ozon > 0 && <> Чаще занижено на Ozon.</>}
          </p>
          <table className="mt-1 text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pr-4 font-medium">Артикул</th>
                <th className="pr-4 text-right font-medium">ВБ</th>
                <th className="pr-4 text-right font-medium">Ozon</th>
                <th className="text-left font-medium">Что не так</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r) => (
                <tr key={r.article}>
                  <td className="pr-4 py-0.5 font-medium">{r.article}</td>
                  <td className="pr-4 py-0.5 text-right tabular-nums">{formatInt(r.declaredWb)}</td>
                  <td className="pr-4 py-0.5 text-right tabular-nums">
                    {formatInt(r.declaredOzon)}
                  </td>
                  <td className="py-0.5 text-muted-foreground">{r.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 10 && (
            <p className="text-xs text-muted-foreground">
              Показаны первые 10 из {formatInt(rows.length)}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
