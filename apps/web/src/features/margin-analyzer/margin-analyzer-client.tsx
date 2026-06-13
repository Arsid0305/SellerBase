'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, TrendingDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  COMPONENT_LABEL,
  type ComponentKey,
  type SkuMarginAnalysis,
} from '@/entities/margin-analyzer';

const fmtRub = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';

const fmtPct = (p: number | null | undefined, signed = false) => {
  if (p == null) return '—';
  const v = p * 100;
  const s = v.toFixed(1).replace('.', ',');
  return signed && v > 0 ? `+${s}%` : `${s}%`;
};

type Filter = 'falling' | 'all' | 'losing';

const COMPONENT_KEYS: ComponentKey[] = [
  'commission',
  'logistics',
  'storage',
  'cogs',
  'tax',
  'acquiring',
  'penalty',
  'deduction',
  'rebillLogistic',
  'returns',
];

function marginColor(pct: number | null) {
  if (pct == null) return 'text-muted-foreground';
  if (pct >= 0.2) return 'text-emerald-600';
  if (pct >= 0.15) return 'text-amber-600';
  if (pct >= 0) return 'text-orange-600';
  return 'text-red-600';
}

function deltaColor(delta: number | null) {
  if (delta == null) return 'text-muted-foreground';
  if (delta >= 0) return 'text-emerald-600';
  if (delta >= -0.05) return 'text-amber-600';
  return 'text-red-600';
}

export function MarginAnalyzerClient({ rows }: { rows: SkuMarginAnalysis[] }) {
  const [filter, setFilter] = useState<Filter>('falling');
  const [openNm, setOpenNm] = useState<number | null>(null);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'falling':
        return rows.filter((r) => (r.deltaPct ?? 0) < -0.02);
      case 'losing':
        return rows.filter((r) => r.current.marginPct != null && r.current.marginPct < 0);
      default:
        return rows;
    }
  }, [filter, rows]);

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    {
      key: 'falling',
      label: 'Падает',
      count: rows.filter((r) => (r.deltaPct ?? 0) < -0.02).length,
    },
    {
      key: 'losing',
      label: 'Минус',
      count: rows.filter((r) => r.current.marginPct != null && r.current.marginPct < 0).length,
    },
    { key: 'all', label: 'Все', count: rows.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition',
              filter === f.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label} · {f.count}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Товар</th>
              <th className="px-3 py-2 text-right">Выручка по карточке</th>
              <th className="px-3 py-2 text-right">Маржа сейчас</th>
              <th className="px-3 py-2 text-right">Δ vs ср. 4 нед</th>
              <th className="px-3 py-2 text-left">Главный виновник</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  Нет данных по этому фильтру
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <SkuRow
                  key={r.nmId}
                  data={r}
                  open={openNm === r.nmId}
                  onToggle={() => setOpenNm(openNm === r.nmId ? null : r.nmId)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Маржа = (ppvz_for_pay − логистика − хранение − эквайринг − штрафы − удержания − перевыставленная логистика − COGS − УСН 7%) ÷ «выручка по карточке».
        «Главный виновник» — компонент, чья доля от выручки выросла сильнее всего по сравнению со средним за 4 предыдущих недели.
      </p>
    </div>
  );
}

function SkuRow({
  data,
  open,
  onToggle,
}: {
  data: SkuMarginAnalysis;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-border transition last:border-b-0 hover:bg-muted/30"
      >
        <td className="px-3 py-2">
          <div className="line-clamp-1 max-w-xs font-medium">
            {data.title ?? data.myArticle ?? `nm ${data.nmId}`}
          </div>
          <div className="text-xs text-muted-foreground">
            {data.myArticle && <span>{data.myArticle} · </span>}
            {data.nmId}
            {data.subjectName && <span> · {data.subjectName}</span>}
          </div>
        </td>
        <td className="px-3 py-2 text-right tabular-nums">{fmtRub(data.current.byCardRub)}</td>
        <td className={cn('px-3 py-2 text-right tabular-nums', marginColor(data.current.marginPct))}>
          {fmtPct(data.current.marginPct)}
          <div className="text-xs text-muted-foreground">{fmtRub(data.current.netProfitRub)}</div>
        </td>
        <td className={cn('px-3 py-2 text-right tabular-nums', deltaColor(data.deltaPct))}>
          <span className="inline-flex items-center gap-1">
            {data.deltaPct != null && data.deltaPct < 0 && <ArrowDown className="h-3 w-3" />}
            {data.deltaPct != null && data.deltaPct > 0 && <ArrowUp className="h-3 w-3" />}
            {fmtPct(data.deltaPct, true)}
          </span>
        </td>
        <td className="px-3 py-2">
          {data.worstComponent ? (
            <div className="flex items-center gap-1.5 text-sm">
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              <span className="font-medium">{COMPONENT_LABEL[data.worstComponent.key]}</span>
              <span className="text-xs text-muted-foreground">
                +{(data.worstComponent.deltaPctOfRevenue * 100).toFixed(1).replace('.', ',')}% от выручки
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border bg-muted/10">
          <td colSpan={5} className="px-3 py-4">
            <BreakdownDetail data={data} />
          </td>
        </tr>
      )}
    </>
  );
}

function BreakdownDetail({ data }: { data: SkuMarginAnalysis }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="px-2 py-1 text-left">Компонент</th>
            {data.weeks.map((w) => (
              <th key={w.weekStart} className="px-2 py-1 text-right">
                {new Date(w.weekStart).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                })}
              </th>
            ))}
            <th className="px-2 py-1 text-right">Δ сейчас vs ср.</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border">
            <td className="px-2 py-1 font-medium">Выручка по карточке</td>
            {data.weeks.map((w) => (
              <td key={w.weekStart} className="px-2 py-1 text-right tabular-nums">
                {fmtRub(w.byCardRub)}
              </td>
            ))}
            <td className="px-2 py-1 text-right text-muted-foreground">—</td>
          </tr>
          {COMPONENT_KEYS.map((key) => {
            const cur = data.current.components[key];
            const avg = data.prevAvg?.components[key] ?? 0;
            const curPct = data.current.byCardRub > 0 ? cur / data.current.byCardRub : 0;
            const avgPct =
              data.prevAvg && data.prevAvg.byCardRub > 0
                ? avg / data.prevAvg.byCardRub
                : 0;
            const deltaPct = curPct - avgPct;
            return (
              <tr key={key} className="border-t border-border">
                <td className="px-2 py-1">{COMPONENT_LABEL[key]}</td>
                {data.weeks.map((w) => {
                  const v = w.components[key];
                  const pct = w.byCardRub > 0 ? v / w.byCardRub : 0;
                  return (
                    <td key={w.weekStart} className="px-2 py-1 text-right tabular-nums">
                      {fmtRub(v)}
                      <div className="text-[10px] text-muted-foreground">
                        {(pct * 100).toFixed(1).replace('.', ',')}%
                      </div>
                    </td>
                  );
                })}
                <td
                  className={cn(
                    'px-2 py-1 text-right tabular-nums',
                    deltaPct > 0.01
                      ? 'text-red-600'
                      : deltaPct < -0.01
                        ? 'text-emerald-600'
                        : 'text-muted-foreground',
                  )}
                >
                  {deltaPct > 0 ? '+' : ''}
                  {(deltaPct * 100).toFixed(1).replace('.', ',')}%
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-border font-medium">
            <td className="px-2 py-1">Чистая прибыль</td>
            {data.weeks.map((w) => (
              <td
                key={w.weekStart}
                className={cn('px-2 py-1 text-right tabular-nums', marginColor(w.marginPct))}
              >
                {fmtRub(w.netProfitRub)}
                <div className="text-[10px]">{fmtPct(w.marginPct)}</div>
              </td>
            ))}
            <td className="px-2 py-1 text-right" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
