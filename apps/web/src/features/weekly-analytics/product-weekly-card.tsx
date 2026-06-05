import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatCompact, formatInt, formatRub } from '@/shared/lib/format';
import { fetchWeeklyBySku } from '@/entities/sku-weekly';

const WIDTH = 640;
const HEIGHT = 200;
const PAD_X = 36;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

export async function ProductWeeklyCard({ skuId, year = 2026 }: { skuId: number; year?: number }) {
  const rows = await fetchWeeklyBySku(skuId, year);
  if (rows.length === 0) return null;

  const max = rows.reduce((acc, r) => Math.max(acc, Number(r.revenue_wb) || 0), 0) * 1.1 || 1;
  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = rows.length > 1 ? innerW / (rows.length - 1) : innerW;

  const points = rows.map((r, i) => {
    const x = PAD_X + i * step;
    const y = PAD_TOP + innerH - ((Number(r.revenue_wb) || 0) / max) * innerH;
    return { x, y, w: r.week_num };
  });
  const line = points
    .map((pt, i) => (i === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`))
    .join(' ');

  const last10 = rows.slice(-10).reverse();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">По неделям {year}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
          <path d={line} className="stroke-emerald-500" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {points.length > 0 && points[0] && points[points.length - 1] ? (
            <>
              <text x={PAD_X} y={HEIGHT - 6} className="fill-muted-foreground text-[10px]" textAnchor="start">
                Нед {points[0]!.w}
              </text>
              <text x={WIDTH - PAD_X} y={HEIGHT - 6} className="fill-muted-foreground text-[10px]" textAnchor="end">
                Нед {points[points.length - 1]!.w}
              </text>
            </>
          ) : null}
        </svg>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-1.5">Неделя</th>
                <th className="px-2 py-1.5 text-right">Продано</th>
                <th className="px-2 py-1.5 text-right">Выручка</th>
                <th className="px-2 py-1.5 text-right">Прибыль</th>
              </tr>
            </thead>
            <tbody>
              {last10.map((r) => (
                <tr key={r.week_num} className="border-b last:border-0">
                  <td className="px-2 py-1.5 font-mono">№{r.week_num}</td>
                  <td className="px-2 py-1.5 text-right">{formatInt(Number(r.units_sold) || 0)}</td>
                  <td className="px-2 py-1.5 text-right">{formatRub(Number(r.revenue_wb) || 0)}</td>
                  <td className={`px-2 py-1.5 text-right ${Number(r.net_profit) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatRub(Number(r.net_profit) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
