import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatCompact } from '@/shared/lib/format';
import type { WeeklySummaryPoint } from '@/entities/sku-weekly';

const WIDTH = 800;
const HEIGHT = 280;
const PAD_X = 40;
const PAD_TOP = 16;
const PAD_BOTTOM = 32;

function buildPath(
  data: WeeklySummaryPoint[],
  pick: (p: WeeklySummaryPoint) => number,
  max: number,
): { line: string; area: string; points: { x: number; y: number; w: number }[] } {
  if (data.length === 0) return { line: '', area: '', points: [] };
  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const points = data.map((p, i) => {
    const x = PAD_X + i * step;
    const y = PAD_TOP + innerH - (pick(p) / max) * innerH;
    return { x, y, w: p.week_num };
  });
  const line = points
    .map((pt, i) => (i === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`))
    .join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  const baseline = HEIGHT - PAD_BOTTOM;
  const area = first && last ? `${line} L ${last.x.toFixed(1)} ${baseline} L ${first.x.toFixed(1)} ${baseline} Z` : '';
  return { line, area, points };
}

export function WeeklyRevenueProfitChart({ data }: { data: WeeklySummaryPoint[] }) {
  const max =
    data.reduce((acc, p) => Math.max(acc, p.revenue, Math.abs(p.profit)), 0) * 1.1 || 1;
  const revenue = buildPath(data, (p) => p.revenue, max);
  const profit = buildPath(data, (p) => Math.max(0, p.profit), max);
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const gridLines = [0.25, 0.5, 0.75];
  const xLabels = data.length > 0
    ? [0, Math.floor(data.length / 2), data.length - 1]
        .map((i) => ({ idx: i, pt: revenue.points[i] }))
        .filter((x): x is { idx: number; pt: { x: number; y: number; w: number } } => Boolean(x.pt))
    : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Выручка и прибыль по неделям</CardTitle>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            Выручка
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-sky-500" />
            Прибыль
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Нет данных</p>
        ) : (
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[280px] w-full" preserveAspectRatio="none">
            {gridLines.map((g) => {
              const y = PAD_TOP + innerH * g;
              const label = max * (1 - g);
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
                    {formatCompact(label)}
                  </text>
                </g>
              );
            })}
            <path d={revenue.area} className="fill-emerald-500/10" />
            <path d={revenue.line} className="stroke-emerald-500" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <path d={profit.line} className="stroke-sky-500" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {xLabels.map((x) => (
              <text key={x.idx} x={x.pt.x} y={HEIGHT - 8} className="fill-muted-foreground text-[10px]" textAnchor="middle">
                Нед {x.pt.w}
              </text>
            ))}
          </svg>
        )}
      </CardContent>
    </Card>
  );
}
