'use client';

import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatCompact, formatDate, formatRub } from '@/shared/lib/format';
import type { DailyPoint } from '@/features/dashboard/types';

const WIDTH = 1200;
const HEIGHT = 320;
const PAD_LEFT = 56;
const PAD_RIGHT = 56;
const PAD_TOP = 16;
const PAD_BOTTOM = 32;

type LineKey =
  | 'revenue'
  | 'expenses'
  | 'commission'
  | 'logistics'
  | 'storage'
  | 'acquiring'
  | 'cogs'
  | 'tax'
  | 'margin';

type LineCfg = {
  key: LineKey;
  label: string;
  pick: (p: DailyPoint) => number;
  stroke: string;
  dot: string;
  defaultOn: boolean;
  axis: 'money' | 'percent';
  withArea?: boolean;
};

const LINES: LineCfg[] = [
  { key: 'revenue',    label: 'Доходы',      pick: (p) => p.revenue,    stroke: 'stroke-emerald-500', dot: 'bg-emerald-500', defaultOn: true,  axis: 'money', withArea: true },
  { key: 'expenses',   label: 'Расходы',     pick: (p) => p.expenses,   stroke: 'stroke-rose-500',    dot: 'bg-rose-500',    defaultOn: true,  axis: 'money', withArea: true },
  { key: 'commission', label: 'Комиссия',    pick: (p) => p.commission, stroke: 'stroke-violet-500',  dot: 'bg-violet-500',  defaultOn: false, axis: 'money' },
  { key: 'logistics',  label: 'Логистика',   pick: (p) => p.logistics,  stroke: 'stroke-sky-500',     dot: 'bg-sky-500',     defaultOn: false, axis: 'money' },
  { key: 'storage',    label: 'Хранение',    pick: (p) => p.storage,    stroke: 'stroke-amber-500',   dot: 'bg-amber-500',   defaultOn: false, axis: 'money' },
  { key: 'acquiring',  label: 'Эквайринг',   pick: (p) => p.acquiring,  stroke: 'stroke-cyan-500',    dot: 'bg-cyan-500',     defaultOn: false, axis: 'money' },
  { key: 'cogs',       label: 'Себестоимость', pick: (p) => p.cogs,     stroke: 'stroke-orange-500',  dot: 'bg-orange-500',  defaultOn: false, axis: 'money' },
  { key: 'tax',        label: 'Налог',       pick: (p) => p.tax,        stroke: 'stroke-slate-500',   dot: 'bg-slate-500',   defaultOn: false, axis: 'money' },
  { key: 'margin',     label: 'Маржа, %',    pick: (p) => p.marginPct,  stroke: 'stroke-fuchsia-500', dot: 'bg-fuchsia-500', defaultOn: true,  axis: 'percent' },
];

function buildPath(data: DailyPoint[], pick: (p: DailyPoint) => number, max: number, min: number, innerW: number, innerH: number, withArea: boolean) {
  if (data.length === 0) return { pathLine: '', pathArea: '' };
  const range = max - min || 1;
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const points = data.map((p, i) => {
    const x = PAD_LEFT + i * step;
    const y = PAD_TOP + innerH - ((pick(p) - min) / range) * innerH;
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

export function PnLChart({ data, title = 'Динамика P&L' }: { data: DailyPoint[]; title?: string }) {
  const [on, setOn] = useState<Record<LineKey, boolean>>(() =>
    Object.fromEntries(LINES.map((s) => [s.key, s.defaultOn])) as Record<LineKey, boolean>,
  );
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const activeMoney = useMemo(() => LINES.filter((l) => on[l.key] && l.axis === 'money'), [on]);
  const activeMargin = useMemo(() => LINES.filter((l) => on[l.key] && l.axis === 'percent'), [on]);

  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const moneyMax = useMemo(() => {
    let m = 0;
    for (const p of data) for (const l of activeMoney) m = Math.max(m, l.pick(p));
    return m * 1.1 || 1;
  }, [data, activeMoney]);
  const moneyMin = 0;

  const marginRange = useMemo(() => {
    if (activeMargin.length === 0) return { min: 0, max: 100 };
    let min = Infinity, max = -Infinity;
    for (const p of data) for (const l of activeMargin) {
      const v = l.pick(p);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!Number.isFinite(min)) { min = 0; max = 100; }
    const pad = Math.max(5, (max - min) * 0.15);
    return { min: Math.floor(min - pad), max: Math.ceil(max + pad) };
  }, [data, activeMargin]);

  const moneyPaths = activeMoney.map((l) => ({ cfg: l, ...buildPath(data, l.pick, moneyMax, moneyMin, innerW, innerH, l.withArea ?? false) }));
  const marginPaths = activeMargin.map((l) => ({ cfg: l, ...buildPath(data, l.pick, marginRange.max, marginRange.min, innerW, innerH, false) }));

  const gridLines = [0.25, 0.5, 0.75];
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const xLabelIdxs = data.length <= 12 ? data.map((_, i) => i) : [0, Math.floor(data.length / 2), data.length - 1];
  const xLabels = xLabelIdxs.map((i) => ({ idx: i, x: PAD_LEFT + i * step, raw: data[i]! })).filter((x) => x.raw);

  const granularityLabel = data.length >= 2
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {LINES.map((s) => (
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
        {activeMoney.length === 0 && activeMargin.length === 0 ? (
          <div className="flex h-[320px] w-full items-center justify-center text-sm text-muted-foreground">
            Выберите линии в легенде
          </div>
        ) : (
        <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-[320px] w-full"
          preserveAspectRatio="none"
          onMouseMove={(e) => {
            if (!svgRef.current || data.length === 0) return;
            const rect = svgRef.current.getBoundingClientRect();
            const xSvg = ((e.clientX - rect.left) / rect.width) * WIDTH;
            const innerXSvg = xSvg - PAD_LEFT;
            const stepLocal = data.length > 1 ? innerW / (data.length - 1) : innerW;
            const idx = Math.round(innerXSvg / stepLocal);
            if (idx >= 0 && idx < data.length) setHoverIdx(idx);
            else setHoverIdx(null);
          }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {gridLines.map((g) => {
            const y = PAD_TOP + innerH * g;
            const moneyLabel = (moneyMax * (1 - g)).toFixed(0);
            const marginLabel = (marginRange.max - (marginRange.max - marginRange.min) * g).toFixed(0);
            return (
              <g key={g}>
                <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} className="stroke-border" strokeDasharray="2 4" strokeWidth={1} />
                {activeMoney.length > 0 && (
                  <text x={PAD_LEFT - 6} y={y + 3} className="fill-muted-foreground text-[10px]" textAnchor="end">
                    {formatCompact(Number(moneyLabel))}
                  </text>
                )}
                {activeMargin.length > 0 && (
                  <text x={WIDTH - PAD_RIGHT + 6} y={y + 3} className="fill-fuchsia-600 dark:fill-fuchsia-400 text-[10px]" textAnchor="start">
                    {marginLabel}%
                  </text>
                )}
              </g>
            );
          })}
          {moneyPaths.map(({ cfg, pathArea, pathLine }) => (
            <g key={cfg.key}>
              {cfg.withArea && pathArea && <path d={pathArea} className={cfg.stroke.replace('stroke-', 'fill-').replace('-500', '-500/10')} />}
              <path d={pathLine} className={cfg.stroke} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
          {marginPaths.map(({ cfg, pathLine }) => (
            <path key={cfg.key} d={pathLine} className={cfg.stroke} fill="none" strokeWidth={2} strokeDasharray="6 3" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {xLabels.map((x) => (
            <text key={x.idx} x={x.x} y={HEIGHT - 10} className="fill-muted-foreground text-[10px]" textAnchor="middle">
              {formatDate(x.raw.date)}
            </text>
          ))}
          {hoverIdx !== null && data[hoverIdx] && (() => {
            const stepLocal = data.length > 1 ? innerW / (data.length - 1) : innerW;
            const hx = PAD_LEFT + hoverIdx * stepLocal;
            return (
              <g>
                <line x1={hx} x2={hx} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} className="stroke-muted-foreground/40" strokeWidth={1} />
                {activeMoney.map(({ key, pick, dot }) => {
                  const v = pick(data[hoverIdx]!);
                  const y = PAD_TOP + innerH - (v / moneyMax) * innerH;
                  return <circle key={key} cx={hx} cy={y} r={3} className={dot.replace('bg-', 'fill-')} />;
                })}
                {activeMargin.map(({ key, pick, dot }) => {
                  const v = pick(data[hoverIdx]!);
                  const y = PAD_TOP + innerH - ((v - marginRange.min) / (marginRange.max - marginRange.min)) * innerH;
                  return <circle key={key} cx={hx} cy={y} r={3} className={dot.replace('bg-', 'fill-')} />;
                })}
              </g>
            );
          })()}
        </svg>
        {hoverIdx !== null && data[hoverIdx] && (() => {
          const stepLocal = data.length > 1 ? innerW / (data.length - 1) : innerW;
          const hxPct = ((PAD_LEFT + hoverIdx * stepLocal) / WIDTH) * 100;
          const placeRight = hxPct < 70;
          return (
            <div
              className="pointer-events-none absolute z-10 min-w-[180px] rounded-md border border-border bg-background p-2 text-xs shadow-lg"
              style={{
                top: '8px',
                left: placeRight ? `calc(${hxPct}% + 8px)` : undefined,
                right: !placeRight ? `calc(${100 - hxPct}% + 8px)` : undefined,
              }}
            >
              <div className="mb-1 font-medium tabular-nums">{formatDate(data[hoverIdx]!.date)}</div>
              <ul className="space-y-0.5">
                {[...activeMoney, ...activeMargin].map(({ key, label, pick, dot, axis }) => {
                  const v = pick(data[hoverIdx]!);
                  const shown = axis === 'percent' ? `${v.toFixed(1)}%` : formatRub(Math.round(v));
                  return (
                    <li key={key} className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <span className={`inline-block size-2 rounded-full ${dot}`} />
                        {label}
                      </span>
                      <span className="tabular-nums">{shown}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })()}
        </div>
        )}
        {(activeMoney.length > 0 || activeMargin.length > 0) && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Левая ось — ₽, правая ось — Маржа %. Маржа рисуется штрихом.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
