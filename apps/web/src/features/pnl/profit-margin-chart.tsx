import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatDate } from '@/shared/lib/format';
import type { ProfitMarginPoint } from './types';

const WIDTH = 800;
const HEIGHT = 200;
const PAD_X = 40;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

export function ProfitMarginChart({ data }: { data: ProfitMarginPoint[] }) {
  if (data.length === 0) return null;

  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const maxValue = Math.max(...data.map((d) => d.margin), 50);
  const minValue = 0;
  const range = maxValue - minValue || 1;
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const points = data.map((p, i) => {
    const x = PAD_X + i * step;
    const y = PAD_TOP + innerH - ((p.margin - minValue) / range) * innerH;
    return { x, y, raw: p };
  });

  const pathLine = points
    .map((pt, i) => (i === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`))
    .join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const pathArea =
    last && first
      ? `${pathLine} L ${last.x.toFixed(1)} ${HEIGHT - PAD_BOTTOM} L ${first.x.toFixed(1)} ${HEIGHT - PAD_BOTTOM} Z`
      : '';

  const gridLines = [0.25, 0.5, 0.75];
  const xLabels = [0, Math.floor(data.length / 2), data.length - 1]
    .map((i) => points[i])
    .filter((p): p is { x: number; y: number; raw: ProfitMarginPoint } => Boolean(p));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Динамика маржи</CardTitle>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-violet-500" />
          Маржа, %
        </div>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[200px] w-full" preserveAspectRatio="none">
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
                  {label}%
                </text>
              </g>
            );
          })}
          <path d={pathArea} className="fill-violet-500/10" />
          <path
            d={pathLine}
            className="stroke-violet-500"
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {xLabels.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={HEIGHT - 8}
              className="fill-muted-foreground text-[10px]"
              textAnchor="middle"
            >
              {formatDate(p.raw.date)}
            </text>
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}
