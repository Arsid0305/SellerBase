'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { TooltipIcon } from '@/shared/ui/tooltip-icon';
import { Badge } from '@/shared/ui/badge';
import { formatRub, formatInt } from '@/shared/lib/format';
import type { MainCulprit, MarginAnalysisRow } from '@/entities/margin-analyzer-v2';

type FilterKey = 'all' | 'falling' | 'growing' | 'losing';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'falling', label: 'Маржа упала >5pp' },
  { key: 'growing', label: 'Маржа выросла' },
  { key: 'losing', label: 'Перешли в убыток' },
];

const CULPRIT_LABEL: Record<MainCulprit, string> = {
  commission_up: 'Комиссия выросла',
  logistics_up: 'Логистика выросла',
  storage_up: 'Хранение съело',
  returns_up: 'Возвраты выросли',
  cost_up: 'Себес вырос',
  revenue_down: 'Выручка упала',
  price_down: 'Цена снизилась',
  none: '—',
};

const CULPRIT_CLASS: Record<MainCulprit, string> = {
  commission_up: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300',
  logistics_up: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300',
  storage_up: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300',
  returns_up: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300',
  revenue_down: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300',
  cost_up: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  price_down: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  none: 'border-border bg-muted/40 text-muted-foreground',
};

type SortKey = 'marginDeltaPp' | 'marginNowPct' | 'revenueDeltaPct';

function fmtPct(v: number, signed = false): string {
  const s = Math.abs(v) < 0.01 ? '0,0' : v.toFixed(1).replace('.', ',');
  return signed && v > 0 ? `+${s}%` : `${s}%`;
}

function fmtPp(v: number): string {
  const s = Math.abs(v) < 0.01 ? '0,0' : v.toFixed(1).replace('.', ',');
  return v > 0 ? `+${s} pp` : `${s} pp`;
}

function rowTone(row: MarginAnalysisRow): string {
  if (row.marginNowPct < 0 && row.marginPrevPct >= 0) return 'bg-rose-50/60 dark:bg-rose-950/20';
  if (row.marginDeltaPp <= -5) return 'bg-amber-50/60 dark:bg-amber-950/20';
  if (row.marginDeltaPp > 0) return 'bg-emerald-50/40 dark:bg-emerald-950/15';
  return '';
}

function marginColor(pct: number): string {
  if (pct < 0) return 'text-rose-600';
  if (pct < 10) return 'text-amber-600';
  return 'text-emerald-600';
}

function deltaColor(pp: number): string {
  if (pp <= -5) return 'text-rose-600';
  if (pp < 0) return 'text-amber-600';
  if (pp > 0) return 'text-emerald-600';
  return 'text-muted-foreground';
}

export function MarginAnalyzerTable({ rows }: { rows: MarginAnalysisRow[] }) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('marginDeltaPp');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      falling: rows.filter((r) => r.marginDeltaPp < -5).length,
      growing: rows.filter((r) => r.marginDeltaPp > 0).length,
      losing: rows.filter((r) => r.marginNowPct < 0 && r.marginPrevPct >= 0).length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    let base = rows;
    switch (filter) {
      case 'falling':
        base = base.filter((r) => r.marginDeltaPp < -5);
        break;
      case 'growing':
        base = base.filter((r) => r.marginDeltaPp > 0);
        break;
      case 'losing':
        base = base.filter((r) => r.marginNowPct < 0 && r.marginPrevPct >= 0);
        break;
      default:
        break;
    }
    if (debouncedSearch.length > 0) {
      base = base.filter((r) => {
        const haystack = [r.myArticle, r.wbArticle?.toString(), r.title, r.barcode]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(debouncedSearch);
      });
    }
    return base;
  }, [rows, filter, debouncedSearch]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortAsc ? av - bv : bv - av;
    });
    return arr;
  }, [filtered, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(key !== 'marginDeltaPp');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
              {f.label} · {counts[f.key]}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по артикулу, штрихкоду, названию…"
          className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-left">Товар</th>
              <th
                scope="col"
                aria-sort={sortKey === 'marginNowPct' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                tabIndex={0}
                className="cursor-pointer select-none px-3 py-2 text-right hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={() => toggleSort('marginNowPct')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('marginNowPct'); }
                }}
              >
                Маржа сейчас
              </th>
              <th scope="col" className="px-3 py-2 text-right">Маржа было</th>
              <th
                scope="col"
                aria-sort={sortKey === 'marginDeltaPp' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                tabIndex={0}
                className="cursor-pointer select-none px-3 py-2 text-right hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={() => toggleSort('marginDeltaPp')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('marginDeltaPp'); }
                }}
              >
                <span className="inline-flex items-center gap-1">
                  Δ маржи
                  <TooltipIcon text="pp = процентные пункты. Разница маржи сейчас и маржи в предыдущем 30-дневном периоде." />
                </span>
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                <span className="inline-flex items-center gap-1">
                  Главный виновник
                  <TooltipIcon text="Статья расходов или выручки, которая сильнее всего повлияла на падение маржи относительно предыдущего периода." />
                </span>
              </th>
              <th
                scope="col"
                aria-sort={sortKey === 'revenueDeltaPct' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                tabIndex={0}
                className="cursor-pointer select-none px-3 py-2 text-right hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={() => toggleSort('revenueDeltaPct')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort('revenueDeltaPct'); }
                }}
              >
                Δ выручки
              </th>
              <th className="px-3 py-2 text-left">Действие</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  Нет данных по этому фильтру
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row.skuId}
                  className={cn('border-b border-border last:border-b-0 hover:bg-accent/30', rowTone(row))}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <SkuThumb src={row.photoUrl} alt={row.title} />
                      <div className="min-w-0">
                        <div className="line-clamp-1 max-w-xs font-medium">{row.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.myArticle && <span>{row.myArticle} · </span>}
                          {row.wbArticle ?? '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={cn('px-3 py-2 text-right tabular-nums', marginColor(row.marginNowPct))}>
                    {fmtPct(row.marginNowPct)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {fmtPct(row.marginPrevPct)}
                  </td>
                  <td className={cn('px-3 py-2 text-right tabular-nums', deltaColor(row.marginDeltaPp))}>
                    {fmtPp(row.marginDeltaPp)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={cn('whitespace-nowrap', CULPRIT_CLASS[row.mainCulprit])}>
                      {CULPRIT_LABEL[row.mainCulprit]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <div className={row.revenueDeltaPct < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {fmtPct(row.revenueDeltaPct, true)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatRub(row.revenueNow)} · {formatInt(row.unitsNow)} шт
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{row.recommendation}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Сравнение текущих 30 дней с предыдущими 30 днями. «pp» — процентные пункты (разница процентов, не относительное
        изменение). «Главный виновник» — статья, которая сильнее всего увеличила свою долю от выручки и съела маржу.
      </p>
    </div>
  );
}
