import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatRub, formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

type MetricKind = 'money' | 'units' | 'pct';

export type CompareMetric = {
  label: string;
  a: number;
  b: number;
  kind: MetricKind;
  /** Если true — рост значения трактуется как негатив (расходы). */
  inverted?: boolean;
};

function formatValue(v: number, kind: MetricKind): string {
  if (kind === 'money') return formatRub(v);
  if (kind === 'units') return formatInt(v);
  return `${v.toFixed(1)}%`;
}

function formatDeltaAbs(delta: number, kind: MetricKind): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  const abs = Math.abs(delta);
  if (kind === 'money') return `${sign}${formatRub(abs).replace('−', '')}`;
  if (kind === 'units') return `${sign}${formatInt(abs)}`;
  return `${sign}${abs.toFixed(1)} п.п.`;
}

function formatDeltaPct(a: number, b: number): string {
  if (b === 0) {
    if (a === 0) return '0%';
    return a > 0 ? '+∞' : '−∞';
  }
  const pct = ((a - b) / Math.abs(b)) * 100;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

export function CompareKpiTable({
  metrics,
  labelA,
  labelB,
}: {
  metrics: CompareMetric[];
  labelA: string;
  labelB: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">KPI: A vs B</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Метрика</th>
                <th className="py-2 pr-3 text-right font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-sky-500" />
                    {labelA}
                  </span>
                </th>
                <th className="py-2 pr-3 text-right font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    {labelB}
                  </span>
                </th>
                <th className="py-2 pr-3 text-right font-medium">Дельта</th>
                <th className="py-2 text-right font-medium">Дельта %</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const delta = m.a - m.b;
                const positive = m.inverted ? delta < 0 : delta > 0;
                const negative = m.inverted ? delta > 0 : delta < 0;
                const tone = positive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : negative
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-muted-foreground';
                const Icon = delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown;
                return (
                  <tr key={m.label} className="border-b border-border/50 last:border-b-0">
                    <td className="py-2.5 pr-3 text-muted-foreground">{m.label}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatValue(m.a, m.kind)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                      {formatValue(m.b, m.kind)}
                    </td>
                    <td className={cn('py-2.5 pr-3 text-right tabular-nums', tone)}>
                      <span className="inline-flex items-center gap-1">
                        <Icon className="size-3" />
                        {formatDeltaAbs(delta, m.kind)}
                      </span>
                    </td>
                    <td className={cn('py-2.5 text-right tabular-nums', tone)}>
                      {formatDeltaPct(m.a, m.b)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
