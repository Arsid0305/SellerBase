import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatRub } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { CategoryPnlRow } from '@/entities/pnl';

const BAR_COLORS = [
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-rose-400',
  'bg-cyan-500',
  'bg-lime-500',
  'bg-slate-400',
];

export function IncomeBreakdown({ rows }: { rows: CategoryPnlRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Структура доходов</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Нет данных по выручке за период.
        </CardContent>
      </Card>
    );
  }

  const totalRevenue = rows.reduce((acc, r) => acc + r.revenue, 0);
  const maxRevenue = rows[0]?.revenue ?? 1;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Структура доходов</CardTitle>
        <div className="text-xs text-muted-foreground">
          Итого выручки: <span className="font-medium text-foreground">{formatRub(totalRevenue)}</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-2 font-medium">Категория</th>
                <th className="px-5 py-2 font-medium">Доля от выручки</th>
                <th className="px-5 py-2 text-right font-medium">Сумма</th>
                <th className="px-5 py-2 text-right font-medium">Маржа</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const color = BAR_COLORS[idx % BAR_COLORS.length] ?? 'bg-slate-400';
                const barWidth = (row.revenue / maxRevenue) * 100;
                const marginTone =
                  row.marginPct >= 15
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : row.marginPct >= 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400';
                return (
                  <tr key={row.category} className="border-b border-border last:border-b-0 hover:bg-accent/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn('size-2.5 shrink-0 rounded-full', color)} />
                        <span className="font-medium">{row.category}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-full max-w-32 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', color)}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="w-12 tabular-nums text-xs text-muted-foreground">
                          {row.share.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatRub(row.revenue)}</td>
                    <td className={cn('px-5 py-3 text-right tabular-nums', marginTone)}>
                      {row.marginPct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
