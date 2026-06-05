import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import type { ParetoItem } from '@/entities/pareto';

const WIDTH = 800;
const HEIGHT = 240;
const PAD_X = 44;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

export function ParetoCurve({ items }: { items: ParetoItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Кривая Парето</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-12 text-center text-sm text-muted-foreground">Нет данных за выбранный период</p>
        </CardContent>
      </Card>
    );
  }

  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const n = items.length;
  const step = n > 1 ? innerW / (n - 1) : innerW;

  const points = items.map((it, i) => {
    const x = PAD_X + i * step;
    const y = PAD_TOP + innerH - (it.cumPct / 100) * innerH;
    return { x, y, rank: it.rank, cumPct: it.cumPct };
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

  const y80 = PAD_TOP + innerH - (80 / 100) * innerH;
  const y95 = PAD_TOP + innerH - (95 / 100) * innerH;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  const xTickIdxs = uniqueIndexes([0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Кривая Парето</CardTitle>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            Кум. доля выручки
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-4 border-t border-dashed border-sky-500" />
            80%
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-4 border-t border-dashed border-amber-500" />
            95%
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[240px] w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="pareto-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {gridLines.map((g) => {
            const y = PAD_TOP + innerH * g;
            const label = (100 * (1 - g)).toFixed(0);
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
                  {label}%
                </text>
              </g>
            );
          })}

          <line
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={y80}
            y2={y80}
            className="stroke-sky-500"
            strokeDasharray="4 4"
            strokeWidth={1.25}
          />
          <text x={WIDTH - PAD_X - 4} y={y80 - 4} className="fill-sky-600 text-[10px]" textAnchor="end">
            80% — зона A
          </text>

          <line
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={y95}
            y2={y95}
            className="stroke-amber-500"
            strokeDasharray="4 4"
            strokeWidth={1.25}
          />
          <text x={WIDTH - PAD_X - 4} y={y95 - 4} className="fill-amber-600 text-[10px]" textAnchor="end">
            95% — зона B
          </text>

          <path d={pathArea} fill="url(#pareto-area)" />
          <path
            d={pathLine}
            className="stroke-emerald-500"
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {xTickIdxs.map((i) => {
            const p = points[i];
            if (!p) return null;
            return (
              <text
                key={i}
                x={p.x}
                y={HEIGHT - 8}
                className="fill-muted-foreground text-[10px]"
                textAnchor="middle"
              >
                #{p.rank}
              </text>
            );
          })}
        </svg>
      </CardContent>
    </Card>
  );
}

function uniqueIndexes(arr: number[]): number[] {
  return Array.from(new Set(arr)).sort((a, b) => a - b);
}
