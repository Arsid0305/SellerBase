'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { formatDate } from '@/shared/lib/format';
import type { WbTariffsBox, WbTariffsBoxDynamicsPoint } from '@/entities/wb-tariffs';

const WIDTH = 720;
const HEIGHT = 220;
const PAD_X = 40;
const PAD_TOP = 14;
const PAD_BOTTOM = 28;

function buildPath(data: WbTariffsBoxDynamicsPoint[]): { line: string; area: string; min: number; max: number } {
  if (data.length === 0) return { line: '', area: '', min: 0, max: 1 };
  const min = Math.min(...data.map((d) => d.warehouseCoef)) * 0.9;
  const max = Math.max(...data.map((d) => d.warehouseCoef)) * 1.1 || 1;
  const range = max - min || 1;
  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const pts = data.map((d, i) => ({
    x: PAD_X + i * step,
    y: PAD_TOP + innerH - ((d.warehouseCoef - min) / range) * innerH,
  }));
  const line = pts
    .map((p, i) => (i === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`))
    .join(' ');
  const first = pts[0];
  const last = pts[pts.length - 1];
  const area =
    first && last
      ? `${line} L ${last.x.toFixed(1)} ${HEIGHT - PAD_BOTTOM} L ${first.x.toFixed(1)} ${HEIGHT - PAD_BOTTOM} Z`
      : '';
  return { line, area, min, max };
}

export function WbDynamicsCard({
  warehouses,
  loadDynamics,
}: {
  warehouses: WbTariffsBox[];
  loadDynamics: (warehouseName: string, days: number) => Promise<WbTariffsBoxDynamicsPoint[]>;
}) {
  const [selected, setSelected] = useState<string>(warehouses[0]?.warehouseName ?? '');
  const [days, setDays] = useState<30 | 90>(30);
  const [data, setData] = useState<WbTariffsBoxDynamicsPoint[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!selected) return;
    startTransition(async () => {
      const points = await loadDynamics(selected, days);
      setData(points);
    });
  }, [selected, days, loadDynamics]);

  const { line, area, min, max } = useMemo(() => buildPath(data), [data]);
  const last = data[data.length - 1]?.warehouseCoef ?? 0;
  const first = data[0]?.warehouseCoef ?? 0;
  const delta = last - first;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Динамика коэф. склада</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-border bg-card px-2 py-1 text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.warehouseName}>
                {w.warehouseName}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={days === 30 ? 'default' : 'outline'}
              onClick={() => setDays(30)}
            >
              30 дн
            </Button>
            <Button
              size="sm"
              variant={days === 90 ? 'default' : 'outline'}
              onClick={() => setDays(90)}
            >
              90 дн
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {pending ? 'Загрузка…' : 'Нет данных за выбранный период.'}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-3 text-sm">
              <span className="text-muted-foreground">Сейчас:</span>
              <span className="text-lg font-semibold tabular-nums">{last.toFixed(2)}</span>
              <span
                className={
                  delta < 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : delta > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-muted-foreground'
                }
              >
                {delta >= 0 ? '+' : ''}{delta.toFixed(2)} за период
              </span>
              <span className="text-muted-foreground">
                {data[0] && formatDate(data[0].effectiveDate)} —{' '}
                {data[data.length - 1] && formatDate(data[data.length - 1]!.effectiveDate)}
              </span>
            </div>
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Динамика коэф">
              <defs>
                <linearGradient id="wb-coef-grad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <text x={PAD_X - 4} y={PAD_TOP + 8} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {max.toFixed(2)}
              </text>
              <text x={PAD_X - 4} y={HEIGHT - PAD_BOTTOM} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {min.toFixed(2)}
              </text>
              <path d={area} fill="url(#wb-coef-grad)" className="text-sky-500" />
              <path d={line} fill="none" strokeWidth="2" className="stroke-sky-500" />
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
