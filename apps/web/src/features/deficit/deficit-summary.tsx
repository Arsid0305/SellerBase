import { AlertTriangle, AlertCircle, ShoppingBag, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { TooltipIcon } from '@/shared/ui/tooltip-icon';
import { formatRub, formatInt } from '@/shared/lib/format';
import type { DeficitSummary } from './types';

export function DeficitSummaryCards({ summary }: { summary: DeficitSummary }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <div className="rounded-md bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
            <Wallet className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              Упущенная выручка
              <TooltipIcon text="Оцениваем сколько денег теряем из-за нехватки остатка. Берём средние продажи и среднюю цену за последние 90 дней, умножаем на 14 дней горизонта." />
            </span>
            <span className="text-2xl font-semibold tracking-tight">{formatRub(summary.totalLostRevenue)}</span>
            <span className="text-xs text-muted-foreground">оценка за 14 дней, окно 90 дней</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <div className="rounded-md bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
            <AlertCircle className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted-foreground">Закончились</span>
            <span className="text-2xl font-semibold tracking-tight">{formatInt(summary.outOfStockCount)} шт.</span>
            <span className="text-xs text-muted-foreground">остаток 0 шт.</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <div className="rounded-md bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted-foreground">Критичный дефицит</span>
            <span className="text-2xl font-semibold tracking-tight">{formatInt(summary.criticalCount)} шт.</span>
            <span className="text-xs text-muted-foreground">хватит меньше 3 дней</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <div className="rounded-md bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
            <ShoppingBag className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted-foreground">Всего в дефиците</span>
            <span className="text-2xl font-semibold tracking-tight">{formatInt(summary.totalRows)} товаров</span>
            <span className="text-xs text-muted-foreground">требует поставки</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
