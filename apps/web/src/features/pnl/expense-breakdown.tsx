import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatRub } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { ExpenseCategory } from './types';

const GROUP_COLOR: Record<ExpenseCategory['group'], string> = {
  mp: 'bg-violet-500',
  logistics: 'bg-sky-500',
  product: 'bg-amber-500',
  finance: 'bg-emerald-500',
  marketing: 'bg-pink-500',
  penalty: 'bg-rose-500',
  other: 'bg-slate-400',
  extra: 'bg-indigo-500',
};

export function ExpenseBreakdown({
  categories,
  totalRevenue,
}: {
  categories: ExpenseCategory[];
  totalRevenue: number;
}) {
  const sortedByAmount = [...categories].sort((a, b) => b.amount - a.amount);
  const maxAmount = sortedByAmount[0]?.amount ?? 1;
  const totalExpenses = sortedByAmount.reduce((acc, c) => acc + c.amount, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Структура расходов</CardTitle>
        <div className="text-xs text-muted-foreground">
          Итого расходов: <span className="font-medium text-foreground">{formatRub(totalExpenses)}</span>{' '}
          ({((totalExpenses / totalRevenue) * 100).toFixed(1)}% от выручки)
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-2 font-medium">Статья</th>
                <th className="px-5 py-2 font-medium">Доля от выручки</th>
                <th className="px-5 py-2 text-right font-medium">Сумма</th>
                <th className="px-5 py-2 text-right font-medium">Изменение</th>
              </tr>
            </thead>
            <tbody>
              {sortedByAmount.map((cat) => {
                const TrendIcon = cat.delta > 0 ? ArrowUpRight : cat.delta < 0 ? ArrowDownRight : Minus;
                const trendTone =
                  cat.delta > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : cat.delta < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground';
                const barWidth = (cat.amount / maxAmount) * 100;
                return (
                  <tr key={cat.key} className="border-b border-border last:border-b-0 hover:bg-accent/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn('size-2.5 shrink-0 rounded-full', GROUP_COLOR[cat.group])} />
                        <span className="font-medium">{cat.label}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-full max-w-32 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', GROUP_COLOR[cat.group])}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="w-12 tabular-nums text-xs text-muted-foreground">
                          {cat.share.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatRub(cat.amount)}</td>
                    <td className={cn('px-5 py-3 text-right tabular-nums', trendTone)}>
                      <span className="inline-flex items-center justify-end gap-1">
                        <TrendIcon className="size-3.5" />
                        {formatRub(Math.abs(cat.delta))}
                      </span>
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
