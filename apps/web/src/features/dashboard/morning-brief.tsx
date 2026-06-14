import Link from 'next/link';
import { Sun, AlertCircle, ListChecks, Search, Lightbulb } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import type { DashboardBrief } from '@/entities/dashboard-brief';

function fmtMoney(v: number): string {
  return `₽${Math.round(v).toLocaleString('ru-RU')}`;
}

function fmtToday(): string {
  const d = new Date();
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });
}

function fmtDayLabel(isoDate: string): string {
  const today = new Date();
  const day = new Date(`${isoDate}T00:00:00Z`);
  const diffDays = Math.round(
    (Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - day.getTime()) /
      86_400_000,
  );
  if (diffDays === 1) return 'Вчера';
  if (diffDays === 2) return 'Позавчера';
  return day.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
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
  const deltaColor =
    delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : delta < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground';

  return (
    <Card className="border-l-4 border-l-emerald-500 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Sun className="size-4 text-amber-500" />
        <span>Утренний бриф</span>
        <span className="text-muted-foreground">· {fmtToday()}</span>
      </div>

      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          {fmtDayLabel(brief.yesterday.date)}:
        </span>
        <Link href="/pnl" className="hover:underline">
          Выручка <span className="font-semibold tabular-nums">{fmtMoney(brief.yesterday.revenue)}</span>
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/pnl" className="hover:underline">
          Прибыль <span className="font-semibold tabular-nums">{fmtMoney(brief.yesterday.profit)}</span>
        </Link>
        <span className={`font-medium tabular-nums ${deltaColor}`}>
          {deltaSign}
          {delta}%
        </span>
      </div>

      <div className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
        {brief.criticalCount > 0 && (
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
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
