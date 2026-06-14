'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatCompact, formatDate } from '@/shared/lib/format';
import type { DailyPoint } from './types';

const WIDTH = 800;
const HEIGHT = 260;
const PAD_X = 52;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

type SeriesKey = 'revenue' | 'expenses' | 'commission' | 'logistics';

type SeriesCfg = {
  key: SeriesKey;
  label: string;
  pick: (p: DailyPoint) => number;
  stroke: string;
  fill: string;
  dot: string;
  withArea?: boolean;
  defaultOn: boolean;
};

const SERIES: SeriesCfg[] = [
  { key: 'revenue', label: 'Доходы', pick: (p) => p.revenue, stroke: 'stroke-emerald-500', fill: 'fill-emerald-500/10', dot: 'bg-emerald-500', withArea: true, defaultOn: true },
  { key: 'expenses', label: 'Расходы', pick: (p) => p.expenses, stroke: 'stroke-rose-500', fill: 'fill-rose-500/10', dot: 'bg-rose-500', withArea: true, defaultOn: true },
  { key: 'commission', label: 'Комиссия WB', pick: (p) => p.commission, stroke: 'stroke-violet-500', fill: 'fill-violet-500/0', dot: 'bg-violet-500', defaultOn: false },
  { key: 'logistics', label: 'Логистика', pick: (p) => p.logistics, stroke: 'stroke-sky-500', fill: 'fill-sky-500/0', dot: 'bg-sky-500', defaultOn: false },
];

function buildPath(data: DailyPoint[], pick: (p: DailyPoint) => number, max: number, withArea: boolean) {
  if (data.length === 0) return { pathLine: '', pathArea: '' };
  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const points = data.map((p, i) => {
    const x = PAD_X + i * step;
    const y = PAD_TOP + innerH - (pick(p) / max) * innerH;
    return { x, y };
  });
  const pathLine = points.map((pt, i) => (i === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const pathArea = withArea && last && first
    ? `${pathLine} L ${last.x.toFixed(1)} ${HEIGHT - PAD_BOTTOM} L ${first.x.toFixed(1)} ${HEIGHT - PAD_BOTTOM} Z`
    : '';
  return { pathLine, pathArea };
}

export function RevenueExpensesChart({ data, title = 'Динамика доходов и расходов' }: { data: DailyPoint[]; title?: string }) {
  const [on, setOn] = useState<Record<SeriesKey, boolean>>(() =>
    Object.fromEntries(SERIES.map((s) => [s.key, s.defaultOn])) as Record<SeriesKey, boolean>,
  );

  const activeSeries = SERIES.filter((s) => on[s.key]);
  const maxValue = data.reduce((acc, p) => {
    let m = acc;
    for (const s of activeSeries) m = Math.max(m, s.pick(p));
    return m;
  }, 0) * 1.1 || 1;

  const computed = activeSeries.map((s) => ({ cfg: s, ...buildPath(data, s.pick, maxValue, s.withArea ?? false) }));

  const gridLines = [0.25, 0.5, 0.75];
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const innerW = WIDTH - PAD_X * 2;
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const xLabelIdxs = data.length <= 12 ? data.map((_, i) => i) : [0, Math.floor(data.length / 2), data.length - 1];
  const xLabels = xLabelIdxs
    .map((i) => ({ idx: i, x: PAD_X + i * step, raw: data[i]! }))
    .filter((x) => x.raw);

  const granularityLabel =
    data.length >= 2
      ? (() => {
          const a = new Date(`${data[0]!.date}T00:00:00Z`).getTime();
          const b = new Date(`${data[1]!.date}T00:00:00Z`).getTime();
          const stepDays = Math.round((b - a) / 86_400_000);
          if (stepDays >= 28) return 'по месяцам';
          if (stepDays >= 7) return 'по неделям';
          return 'по дням';
        })()
      : '';

  const periodLabel = data.length > 0
    ? `${formatDate(data[0]!.date)} — ${formatDate(data[data.length - 1]!.date)}${granularityLabel ? ` · ${granularityLabel}` : ''}`
    : '';

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-base">{title}</CardTitle>
          {periodLabel && <span className="text-xs text-muted-foreground tabular-nums">{periodLabel}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {SERIES.map((s) => (
            <label key={s.key} className="inline-flex cursor-pointer select-none items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={on[s.key]}
                onChange={(e) => setOn((prev) => ({ ...prev, [s.key]: e.target.checked }))}
                className="h-3 w-3"
              />
              <span className={`inline-block size-2 rounded-full ${s.dot}`} />
              {s.label}
            </label>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[260px] w-full" preserveAspectRatio="none">
          {gridLines.map((g) => {
            const y = PAD_TOP + innerH * g;
            const label = (maxValue * (1 - g)).toFixed(0);
            return (
              <g key={g}>
                <line x1={PAD_X} x2={WIDTH - PAD_X} y1={y} y2={y} className="stroke-border" strokeDasharray="2 4" strokeWidth={1} />
                <text x={PAD_X - 6} y={y + 3} className="fill-muted-foreground text-[10px]" textAnchor="end">
                  {formatCompact(Number(label))}
                </text>
              </g>
            );
          })}
          {computed.map(({ cfg, pathArea, pathLine }) => (
            <g key={cfg.key}>
              {cfg.withArea && pathArea && <path d={pathArea} className={cfg.fill} />}
              <path d={pathLine} className={cfg.stroke} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
          {xLabels.map((x) => (
            <text key={x.idx} x={x.x} y={HEIGHT - 8} className="fill-muted-foreground text-[10px]" textAnchor="middle">
              {formatDate(x.raw.date)}
            </text>
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}
