import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatCompact, formatDate, formatRub } from '@/shared/lib/format';
import type { DailyRevenuePoint } from '@/entities/pnl';

const WIDTH = 800;
const HEIGHT = 240;
const PAD_X = 48;
const PAD_TOP = 16;
const PAD_BOTTOM = 32;

function pathFrom(points: { x: number; y: number }[]): string {
  return points
    .map((p, i) => (i === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`))
    .join(' ');
}

export function DualRevenueChart({
  seriesA,
  seriesB,
  labelA,
  labelB,
}: {
  seriesA: DailyRevenuePoint[];
  seriesB: DailyRevenuePoint[];
  labelA: string;
  labelB: string;
}) {
  const n = Math.max(seriesA.length, seriesB.length);
  if (n === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Выручка по дням</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Нет данных в выбранных периодах.</p>
        </CardContent>
      </Card>
    );
  }

  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const maxValue = Math.max(
    1,
    ...seriesA.map((p) => p.revenue),
    ...seriesB.map((p) => p.revenue),
  );
  const step = n > 1 ? innerW / (n - 1) : innerW;

  const toXY = (series: DailyRevenuePoint[]) =>
    series.map((p, i) => ({
      x: PAD_X + i * step,
      y: PAD_TOP + innerH - (p.revenue / maxValue) * innerH,
      raw: p,
    }));

  const ptsA = toXY(seriesA);
  const ptsB = toXY(seriesB);

  const pathA = pathFrom(ptsA);
  const pathB = pathFrom(ptsB);

  const gridLines = [0.25, 0.5, 0.75];
  const xLabelIdx = [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Выручка по дням</CardTitle>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-sky-500" />
            {labelA}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            {labelB}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[240px] w-full" preserveAspectRatio="none">
          {gridLines.map((g) => {
            const y = PAD_TOP + innerH * g;
            const label = formatCompact(maxValue * (1 - g));
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
                <text x={PAD_X - 6} y={y + 3} className="fill-muted-foreground text-[10px]" textAnchor="end">
                  {label}
                </text>
              </g>
            );
          })}
          {pathB && (
            <path d={pathB} className="stroke-emerald-500" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {pathA && (
            <path d={pathA} className="stroke-sky-500" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {xLabelIdx.map((i) => {
            const x = PAD_X + i * step;
            return (
              <text key={i} x={x} y={HEIGHT - 14} className="fill-muted-foreground text-[10px]" textAnchor="middle">
                День {i + 1}
              </text>
            );
          })}
        </svg>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DaySummary label={labelA} accent="bg-sky-500" series={seriesA} />
          <DaySummary label={labelB} accent="bg-emerald-500" series={seriesB} />
        </div>
      </CardContent>
    </Card>
  );
}

function DaySummary({
  label,
  accent,
  series,
}: {
  label: string;
  accent: string;
  series: DailyRevenuePoint[];
}) {
  const total = series.reduce((acc, p) => acc + p.revenue, 0);
  const first = series[0]?.date;
  const last = series[series.length - 1]?.date;
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className={`size-2 rounded-full ${accent}`} />
        {label}
      </div>
      <div className="mt-1 text-base font-semibold tabular-nums">{formatRub(total)}</div>
      {first && last && (
        <div className="text-xs text-muted-foreground tabular-nums">
          {formatDate(first)} — {formatDate(last)} · {series.length} дн.
        </div>
      )}
    </div>
  );
}
