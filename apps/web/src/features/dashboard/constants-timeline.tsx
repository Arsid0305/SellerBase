'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

export type ConstantPoint = {
  dt: string;
  cny_rate: number | null;
  delivery_per_kg: number | null;
  avg_cost_rub: number | null;
};

const W = 800;
const H = 240;
const PAD = { l: 40, r: 40, t: 16, b: 32 };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

type Series = { key: 'cny' | 'delivery' | 'cost'; label: string; color: string; axis: 'left' | 'right'; values: (number | null)[] };

export function ConstantsTimelineCard({ points }: { points: ConstantPoint[] }) {
  const parsed = useMemo(() => {
    const cny = points.map((p) => p.cny_rate);
    const delivery = points.map((p) => p.delivery_per_kg);
    const cost = points.map((p) => p.avg_cost_rub);
    return { cny, delivery, cost };
  }, [points]);

  if (points.length < 2) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">История констант</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Нужно минимум 2 точки. Добавь запись в <code>cargo_tariffs</code>, <code>delivery_to_wb</code> или загрузи заказ Китая.
          </p>
        </CardContent>
      </Card>
    );
  }

  const series: Series[] = [
    { key: 'cny', label: 'Курс CNY ₽/¥', color: '#f59e0b', axis: 'left', values: parsed.cny },
    { key: 'delivery', label: 'Доставка ФФ ₽/кг', color: '#3b82f6', axis: 'left', values: parsed.delivery },
    { key: 'cost', label: 'Средний себес ₽', color: '#10b981', axis: 'right', values: parsed.cost },
  ];

  const leftValues = [...parsed.cny, ...parsed.delivery].filter((v): v is number => v != null);
  const rightValues = parsed.cost.filter((v): v is number => v != null);
  const leftMin = leftValues.length > 0 ? Math.min(...leftValues) * 0.9 : 0;
  const leftMax = leftValues.length > 0 ? Math.max(...leftValues) * 1.1 : 1;
  const rightMin = rightValues.length > 0 ? Math.min(...rightValues) * 0.9 : 0;
  const rightMax = rightValues.length > 0 ? Math.max(...rightValues) * 1.1 : 1;

  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const step = points.length > 1 ? chartW / (points.length - 1) : chartW;
  const scaleLeft = (v: number) => PAD.t + chartH - ((v - leftMin) / (leftMax - leftMin || 1)) * chartH;
  const scaleRight = (v: number) => PAD.t + chartH - ((v - rightMin) / (rightMax - rightMin || 1)) * chartH;

  function pathFor(s: Series): string {
    const pts: string[] = [];
    let started = false;
    s.values.forEach((v, i) => {
      if (v == null) return;
      const x = PAD.l + i * step;
      const y = s.axis === 'left' ? scaleLeft(v) : scaleRight(v);
      if (!started) {
        pts.push(`M ${x} ${y}`);
        started = true;
      } else {
        const prevX = PAD.l + (i - 1) * step;
        pts.push(`L ${prevX} ${y}`);
        pts.push(`L ${x} ${y}`);
      }
    });
    return pts.join(' ');
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">История констант — курсы и себес</CardTitle>
        <div className="flex flex-wrap gap-3 text-xs">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-muted-foreground">{s.label}</span>
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, minWidth: 400 }}>
            <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + chartH} stroke="currentColor" strokeOpacity="0.15" />
            <line x1={W - PAD.r} y1={PAD.t} x2={W - PAD.r} y2={PAD.t + chartH} stroke="currentColor" strokeOpacity="0.15" />
            <line x1={PAD.l} y1={PAD.t + chartH} x2={W - PAD.r} y2={PAD.t + chartH} stroke="currentColor" strokeOpacity="0.15" />

            <text x={PAD.l - 4} y={PAD.t + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.6">{leftMax.toFixed(1)}</text>
            <text x={PAD.l - 4} y={PAD.t + chartH} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.6">{leftMin.toFixed(1)}</text>
            <text x={W - PAD.r + 4} y={PAD.t + 4} fontSize="10" fill="currentColor" opacity="0.6">{Math.round(rightMax)}</text>
            <text x={W - PAD.r + 4} y={PAD.t + chartH} fontSize="10" fill="currentColor" opacity="0.6">{Math.round(rightMin)}</text>

            {series.map((s) => (
              <g key={s.key}>
                <path d={pathFor(s)} fill="none" stroke={s.color} strokeWidth="2" />
                {s.values.map((v, i) => {
                  if (v == null) return null;
                  const x = PAD.l + i * step;
                  const y = s.axis === 'left' ? scaleLeft(v) : scaleRight(v);
                  return <circle key={i} cx={x} cy={y} r="3" fill={s.color} />;
                })}
              </g>
            ))}

            {points.map((p, i) => {
              if (i % Math.ceil(points.length / 6) !== 0 && i !== points.length - 1) return null;
              const x = PAD.l + i * step;
              return (
                <text key={i} x={x} y={H - 8} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.7">
                  {fmtDate(p.dt)}
                </text>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
