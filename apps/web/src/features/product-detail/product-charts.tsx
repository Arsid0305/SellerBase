import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatDate, formatCompact } from '@/shared/lib/format';

const WIDTH = 600;
const HEIGHT = 200;
const PAD_X = 36;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

type Series = { pathLine: string; pathArea: string; points: { x: number; y: number }[] };

function series(
  data: number[],
  max: number,
): Series {
  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const points = data.map((v, i) => ({
    x: PAD_X + i * step,
    y: PAD_TOP + innerH - (v / max) * innerH,
  }));
  const pathLine = points
    .map((p, i) => (i === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`))
    .join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const pathArea =
    last && first
      ? `${pathLine} L ${last.x.toFixed(1)} ${HEIGHT - PAD_BOTTOM} L ${first.x.toFixed(1)} ${HEIGHT - PAD_BOTTOM} Z`
      : '';
  return { points, pathLine, pathArea };
}

export function RevenueByDayChart({
  data,
}: {
  data: { date: string; revenue: number; orders: number }[];
}) {
  const maxRevenue = data.reduce((acc, p) => Math.max(acc, p.revenue), 0) * 1.1 || 1;
  const maxOrders = data.reduce((acc, p) => Math.max(acc, p.orders), 0) * 1.2 || 1;
  const revenue = series(data.map((p) => p.revenue), maxRevenue);
  const orders = series(data.map((p) => p.orders), maxOrders);
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xLabels = [0, Math.floor(data.length / 2), data.length - 1]
    .map((i) => ({ i, x: revenue.points[i]?.x, date: data[i]?.date }))
    .filter((x): x is { i: number; x: number; date: string } => Boolean(x.x && x.date));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold">Выручка по дням</CardTitle>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" /> Выручка, ₽
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-sky-500" /> Заказы, шт
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[200px] w-full" preserveAspectRatio="none">
          {[0.25, 0.5, 0.75].map((g) => {
            const y = PAD_TOP + innerH * g;
            return (
              <g key={g}>
                <line x1={PAD_X} x2={WIDTH - PAD_X} y1={y} y2={y} className="stroke-border" strokeDasharray="2 4" strokeWidth={1} />
                <text x={PAD_X - 6} y={y + 3} className="fill-muted-foreground text-[10px]" textAnchor="end">
                  {formatCompact(maxRevenue * (1 - g))}
                </text>
              </g>
            );
          })}
          <path d={revenue.pathArea} className="fill-emerald-500/10" />
          <path d={revenue.pathLine} className="stroke-emerald-500" fill="none" strokeWidth={2} strokeLinecap="round" />
          <path d={orders.pathLine} className="stroke-sky-500" fill="none" strokeWidth={2} strokeLinecap="round" strokeDasharray="3 3" />
          {xLabels.map((l) => (
            <text key={l.i} x={l.x} y={HEIGHT - 6} className="fill-muted-foreground text-[10px]" textAnchor="middle">
              {formatDate(l.date)}
            </text>
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}

export function StockByDayChart({
  data,
}: {
  data: { date: string; stock: number; inTransit: number }[];
}) {
  const max = data.reduce((acc, p) => Math.max(acc, p.stock, p.inTransit), 0) * 1.1 || 1;
  const stock = series(data.map((p) => p.stock), max);
  const transit = series(data.map((p) => p.inTransit), max);
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xLabels = [0, Math.floor(data.length / 2), data.length - 1]
    .map((i) => ({ i, x: stock.points[i]?.x, date: data[i]?.date }))
    .filter((x): x is { i: number; x: number; date: string } => Boolean(x.x && x.date));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold">Складские остатки по дням</CardTitle>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-sky-500" /> Остаток
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" /> В пути
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[200px] w-full" preserveAspectRatio="none">
          {[0.25, 0.5, 0.75].map((g) => {
            const y = PAD_TOP + innerH * g;
            return (
              <g key={g}>
                <line x1={PAD_X} x2={WIDTH - PAD_X} y1={y} y2={y} className="stroke-border" strokeDasharray="2 4" strokeWidth={1} />
                <text x={PAD_X - 6} y={y + 3} className="fill-muted-foreground text-[10px]" textAnchor="end">
                  {formatCompact(max * (1 - g))}
                </text>
              </g>
            );
          })}
          <path d={stock.pathArea} className="fill-sky-500/10" />
          <path d={stock.pathLine} className="stroke-sky-500" fill="none" strokeWidth={2} strokeLinecap="round" />
          <path d={transit.pathLine} className="stroke-amber-500" fill="none" strokeWidth={2} strokeLinecap="round" strokeDasharray="3 3" />
          {xLabels.map((l) => (
            <text key={l.i} x={l.x} y={HEIGHT - 6} className="fill-muted-foreground text-[10px]" textAnchor="middle">
              {formatDate(l.date)}
            </text>
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}
