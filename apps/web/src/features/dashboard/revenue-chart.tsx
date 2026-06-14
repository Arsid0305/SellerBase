import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatCompact, formatDate } from '@/shared/lib/format';
import type { DailyPoint } from './types';

const WIDTH = 800;
const HEIGHT = 260;
const PAD_X = 36;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

type Series = { points: { x: number; y: number; raw: DailyPoint }[]; pathLine: string; pathArea: string };

function buildSeries(data: DailyPoint[], pick: (p: DailyPoint) => number, max: number): Series {
  if (data.length === 0) return { points: [], pathLine: '', pathArea: '' };
  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const points = data.map((p, i) => {
    const x = PAD_X + i * step;
    const y = PAD_TOP + innerH - (pick(p) / max) * innerH;
    return { x, y, raw: p };
  });

  const pathLine = points
    .map((pt, i) => (i === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`))
    .join(' ');

  const last = points[points.length - 1];
  const first = points[0];
  const pathArea = last && first
    ? `${pathLine} L ${last.x.toFixed(1)} ${HEIGHT - PAD_BOTTOM} L ${first.x.toFixed(1)} ${HEIGHT - PAD_BOTTOM} Z`
    : '';

  return { points, pathLine, pathArea };
}

export function RevenueExpensesChart({ data }: { data: DailyPoint[] }) {
  const maxValue = data.reduce((acc, p) => Math.max(acc, p.revenue, p.expenses), 0) * 1.1 || 1;
  const revenue = buildSeries(data, (p) => p.revenue, maxValue);
  const expenses = buildSeries(data, (p) => p.expenses, maxValue);

  const gridLines = [0.25, 0.5, 0.75];
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xLabels = [0, Math.floor(data.length / 2), data.length - 1]
    .map((i) => ({ idx: i, pt: revenue.points[i] }))
    .filter((x): x is { idx: number; pt: { x: number; y: number; raw: DailyPoint } } => Boolean(x.pt));

  const periodLabel =
    data.length > 0
      ? `${formatDate(data[0]!.date)} — ${formatDate(data[data.length - 1]!.date)} · ${data.length} дн.`
      : '';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-base">Динамика доходов и расходов</CardTitle>
          {periodLabel && (
            <span className="text-xs text-muted-foreground tabular-nums">{periodLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            Доходы
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500" />
            Расходы
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[260px] w-full" preserveAspectRatio="none">
          {gridLines.map((g) => {
            const y = PAD_TOP + innerH * g;
            const label = (maxValue * (1 - g)).toFixed(0);
            return (
              <g key={g}>
                <line
                  x1={PAD_X}
                  x2={WIDTH - PAD_X}
                  y1={y}
                  y2={y}
                  className="stroke-border"
                  strokeDasharray="2 4"
                  strokeWidth={1}
                />
                <text
                  x={PAD_X - 6}
                  y={y + 3}
                  className="fill-muted-foreground text-[10px]"
                  textAnchor="end"
                >
                  {formatCompact(Number(label))}
                </text>
              </g>
            );
          })}

          <path d={expenses.pathArea} className="fill-rose-500/10" />
          <path d={revenue.pathArea} className="fill-emerald-500/10" />
          <path
            d={expenses.pathLine}
            className="stroke-rose-500"
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={revenue.pathLine}
            className="stroke-emerald-500"
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {xLabels.map((x) => (
            <text
              key={x.idx}
              x={x.pt.x}
              y={HEIGHT - 8}
              className="fill-muted-foreground text-[10px]"
              textAnchor="middle"
            >
              {formatDate(x.pt.raw.date)}
            </text>
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}
