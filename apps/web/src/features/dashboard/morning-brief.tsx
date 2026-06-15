import Link from 'next/link';
import { Sun, AlertCircle, ListChecks, Search, Lightbulb } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import type { DashboardBrief } from '@/entities/dashboard-brief';

function fmtMoney(v: number): string {
  return `₽${Math.round(v).toLocaleString('ru-RU')}`;
}

function fmtDataDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' });
}

function fmtShortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function calcDelta(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}

export function MorningBrief({
  brief,
  anomaliesCount,
  insights = [],
}: {
  brief: DashboardBrief;
  anomaliesCount: number;
  insights?: string[];
}) {
  const delta = calcDelta(brief.yesterday.revenue, brief.dayBefore.revenue);
  const deltaSign = delta > 0 ? '+' : '';

  return (
    <Card className="border-l-4 border-l-emerald-500 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Sun className="size-4 text-amber-500" />
        <span>Утренний бриф</span>
        <span className="text-muted-foreground">· {fmtDataDate(brief.yesterday.date)}</span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-border/60 p-3">
          <div className="text-xs text-muted-foreground">Количество</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {brief.yesterday.units.toLocaleString('ru-RU')}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">шт</div>
        </div>
        <Link
          href="/pnl"
          className="block rounded-md border border-border/60 p-3 hover:bg-muted/40"
        >
          <div className="text-xs text-muted-foreground">Сумма</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {fmtMoney(brief.yesterday.revenue)}
          </div>
          <div className="mt-1 flex items-baseline gap-1 text-xs">
            <span className="text-muted-foreground">vs {fmtShortDate(brief.dayBefore.date)}</span>
            <span
              className={`inline-flex items-baseline rounded px-1.5 py-0.5 font-semibold tabular-nums ${
                delta > 0
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : delta < 0
                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {deltaSign}
              {delta}%
            </span>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
        {brief.criticalCount > 0 && (
          <div className="flex items-start gap-2">
            <span
              title={
                'Критичный SKU = одно из двух:\n' +
                '• Остаток = 0, но товар продаётся (упускаем заказы).\n' +
                '• Остаток есть, но продаж не было больше 14 дней (склад висит).\n\n' +
                'Архивные и новые (< 14 дн в каталоге) не считаются.'
              }
              className="mt-0.5 inline-flex shrink-0 cursor-help"
            >
              <AlertCircle className="size-4 text-rose-500" />
            </span>
            <div className="min-w-0">
              <Link href="/products?status=critical" className="font-medium hover:underline">
                Критичных SKU: {brief.criticalCount}
              </Link>
              {brief.criticalTop.length > 0 && (
                <ul className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                  {brief.criticalTop.slice(0, 2).map((s) => (
                    <li key={s.skuId} className="truncate">
                      • {s.title} — {s.hint}
                    </li>
                  ))}
                  {brief.criticalCount > 2 && (
                    <li className="text-muted-foreground">[+{brief.criticalCount - 2} ещё]</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        )}

        {anomaliesCount > 0 && (
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-amber-500" />
            <Link href="/dashboard#anomalies" className="hover:underline">
              Аномалий: <span className="font-medium">{anomaliesCount}</span>
            </Link>
          </div>
        )}

        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-muted-foreground" />
          <Link href="/tasks" className="hover:underline">
            Задач на сегодня: <span className="font-medium">{brief.tasksTodayCount}</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <Link href="/problems" className="hover:underline">
            Открытых проблем: <span className="font-medium">{brief.openProblemsCount}</span>
          </Link>
        </div>
      </div>

      {insights.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-3 text-sm">
          <div className="mb-1 flex items-center gap-2 text-muted-foreground">
            <Lightbulb className="size-4" />
            <span>Сегодня обрати внимание</span>
          </div>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {insights.map((s, i) => (
              <li key={i}>• {s}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
