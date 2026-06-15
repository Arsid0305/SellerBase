'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';
import { formatRub } from '@/shared/lib/format';
import type { SalesHourlyBucket } from '@/entities/sales-hourly';

const WIDTH = 1200;
const HEIGHT = 240;
const PAD_LEFT = 48;
const PAD_RIGHT = 56;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

type TabKey = 'sales' | 'orders' | 'pnl' | 'ads';
type Metric = 'count' | 'sum';

const TABS: { key: TabKey; label: string; available: boolean }[] = [
  { key: 'orders', label: 'Заказы', available: false },
  { key: 'sales', label: 'Выкупы', available: true },
  { key: 'pnl', label: 'Приход и расход', available: false },
  { key: 'ads', label: 'Продвижение', available: false },
];

type Buckets = { today: SalesHourlyBucket; yesterday: SalesHourlyBucket; weekAgo: SalesHourlyBucket };

function bucketByHour(bucket: SalesHourlyBucket, metric: Metric): number[] {
  const arr = Array(24).fill(0);
  for (const p of bucket.points) {
    const h = new Date(p.hour).getUTCHours();
    arr[h] += metric === 'count' ? p.count : p.sumRub;
  }
  return arr;
}

function buildPath(values: number[], max: number, innerW: number, innerH: number): { line: string; area: string } {
  if (values.length === 0) return { line: '', area: '' };
  const step = values.length > 1 ? innerW / (values.length - 1) : innerW;
  const points = values.map((v, i) => {
    const x = PAD_LEFT + i * step;
    const y = PAD_TOP + innerH - (v / max) * innerH;
    return { x, y };
  });
  const line = points.map((pt, i) => (i === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)).join(' ');
  const last = points[points.length - 1]!;
  const first = points[0]!;
  const area = `${line} L ${last.x.toFixed(1)} ${HEIGHT - PAD_BOTTOM} L ${first.x.toFixed(1)} ${HEIGHT - PAD_BOTTOM} Z`;
  return { line, area };
}

function pctDelta(a: number, b: number): number {
  if (b === 0) return a === 0 ? 0 : 100;
  return Math.round(((a - b) / Math.abs(b)) * 100);
}

export function WbStyleChart({ buckets }: { buckets: Buckets }) {
  const [tab, setTab] = useState<TabKey>('sales');
  const [metric, setMetric] = useState<Metric>('sum');

  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const todayHours = useMemo(() => bucketByHour(buckets.today, metric), [buckets.today, metric]);
  const yesterdayHours = useMemo(() => bucketByHour(buckets.yesterday, metric), [buckets.yesterday, metric]);
  const weekAgoHours = useMemo(() => bucketByHour(buckets.weekAgo, metric), [buckets.weekAgo, metric]);

  const max = Math.max(...todayHours, ...yesterdayHours, ...weekAgoHours, 1) * 1.15;

  const today = buildPath(todayHours, max, innerW, innerH);
  const yesterday = buildPath(yesterdayHours, max, innerW, innerH);
  const weekAgo = buildPath(weekAgoHours, max, innerW, innerH);


  const activeTab = TABS.find((t) => t.key === tab)!;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                disabled={!t.available}
                onClick={() => t.available && setTab(t.key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  t.key === tab && t.available && 'bg-foreground text-background',
                  t.key !== tab && t.available && 'text-muted-foreground hover:bg-muted',
                  !t.available && 'cursor-not-allowed text-muted-foreground/40 line-through',
                )}
                title={!t.available ? 'Скоро — нужен новый фетч с WB API' : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">За сегодня · сравнение со вчера и неделей назад</div>
        </div>
      </CardHeader>
      <CardContent>
        {!activeTab.available ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Вкладка «{activeTab.label}» — скоро (нужен новый Edge Function).
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-end gap-6">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Количество</span>
                <span
                  className={cn('text-2xl font-semibold tabular-nums cursor-pointer', metric === 'count' && 'text-foreground', metric !== 'count' && 'text-muted-foreground')}
                  onClick={() => setMetric('count')}
                >
                  {buckets.today.totalCount.toLocaleString('ru-RU')}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {pctDelta(buckets.today.totalCount, buckets.yesterday.totalCount) >= 0 ? '↑' : '↓'} {Math.abs(pctDelta(buckets.today.totalCount, buckets.yesterday.totalCount))}% за день
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {pctDelta(buckets.today.totalCount, buckets.weekAgo.totalCount) >= 0 ? '↑' : '↓'} {Math.abs(pctDelta(buckets.today.totalCount, buckets.weekAgo.totalCount))}% от прошлой недели
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Сумма</span>
                <span
                  className={cn('text-2xl font-semibold tabular-nums cursor-pointer', metric === 'sum' && 'text-foreground', metric !== 'sum' && 'text-muted-foreground')}
                  onClick={() => setMetric('sum')}
                >
                  {formatRub(buckets.today.totalSum)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {pctDelta(buckets.today.totalSum, buckets.yesterday.totalSum) >= 0 ? '↑' : '↓'} {Math.abs(pctDelta(buckets.today.totalSum, buckets.yesterday.totalSum))}% за день
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {pctDelta(buckets.today.totalSum, buckets.weekAgo.totalSum) >= 0 ? '↑' : '↓'} {Math.abs(pctDelta(buckets.today.totalSum, buckets.weekAgo.totalSum))}% от прошлой недели
                </span>
              </div>
              <div className="ml-auto flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4 bg-fuchsia-600" /> Сегодня
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4 border-t border-dashed border-fuchsia-400" /> Вчера
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4 border-t border-dashed border-violet-300" /> Неделю назад
                </span>
              </div>
            </div>
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[240px] w-full" preserveAspectRatio="none">
              {[0.25, 0.5, 0.75].map((g) => {
                const y = PAD_TOP + innerH * g;
                const labelVal = max * (1 - g);
                return (
                  <g key={g}>
                    <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} className="stroke-border" strokeDasharray="2 4" strokeWidth={1} />
                    <text x={WIDTH - PAD_RIGHT + 6} y={y + 3} className="fill-muted-foreground text-[10px]" textAnchor="start">
                      {metric === 'count' ? Math.round(labelVal) : `${Math.round(labelVal / 1000)} тыс.`}
                    </text>
                  </g>
                );
              })}
              <path d={weekAgo.line} className="stroke-violet-300" fill="none" strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d={yesterday.line} className="stroke-fuchsia-400" fill="none" strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d={today.area} className="fill-fuchsia-500/10" />
              <path d={today.line} className="stroke-fuchsia-600" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              {Array.from({ length: 24 }).map((_, h) => {
                if (h % 3 !== 0) return null;
                const x = PAD_LEFT + (innerW / 23) * h;
                return (
                  <text key={h} x={x} y={HEIGHT - 8} className="fill-muted-foreground text-[10px]" textAnchor="middle">
                    {String(h).padStart(2, '0')}
                  </text>
                );
              })}
            </svg>
          </>
        )}
      </CardContent>
    </Card>
  );
}
