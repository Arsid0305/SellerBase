import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatInt } from '@/shared/lib/format';
import type { OzonActionRow } from '@/entities/ozon-prices';

const denRu = (iso: string | null): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

/**
 * Акции Ozon: где мы участвуем и куда ещё можно завести товар.
 *
 * «Можно завести» - это предложение самой площадки: она считает, что товар
 * подходит под условия акции. Пока там больше нуля, деньги лежат не в деле.
 */
export function OzonActionsTable({ rows }: { rows: OzonActionRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Акции Ozon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Акций с площадки ещё не приходило.
        </CardContent>
      </Card>
    );
  }

  const mozhnoZavesti = rows
    .filter((r) => !r.participating)
    .reduce((s, r) => s + (r.productsCould ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Акции Ozon</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          {mozhnoZavesti > 0 ? (
            <>
              Ozon предлагает добавить{' '}
              <span className="font-medium text-foreground">
                {formatInt(mozhnoZavesti)}
              </span>{' '}
              {mozhnoZavesti === 1 ? 'товар' : 'товаров'} в акции, где нас пока нет.
            </>
          ) : (
            'Свободных предложений от площадки нет.'
          )}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-4 text-left font-medium">Акция</th>
                <th className="py-2 pr-4 text-left font-medium">Участвуем</th>
                <th className="py-2 pr-4 text-right font-medium">Товаров в акции</th>
                <th className="py-2 pr-4 text-right font-medium">Можно завести</th>
                <th className="py-2 text-left font-medium">Кончается</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.actionId} className="border-b last:border-0">
                  <td className="py-2 pr-4">{r.title ?? '-'}</td>
                  <td className="py-2 pr-4">
                    {r.participating ? (
                      <span className="text-emerald-600">да</span>
                    ) : (
                      <span className="text-muted-foreground">нет</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatInt(r.productsIn ?? 0)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {(r.productsCould ?? 0) > 0 ? (
                      <span className="font-medium">{formatInt(r.productsCould ?? 0)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="py-2 text-muted-foreground">{denRu(r.endsAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
