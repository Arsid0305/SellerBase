'use client';

import { useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { formatRub } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

export type PnlSkuTableRow = {
  skuId: number;
  title: string;
  myArticle: string | null;
  wbArticle: number | null;
  photoUrl: string | null;
  unitsSold: number;
  revenue: number;
  commission: number;
  logistics: number;
  cogs: number;
  marketing: number;
  tax: number;
  profit: number;
  marginPct: number;
};

type SortKey =
  | 'title'
  | 'unitsSold'
  | 'revenue'
  | 'commission'
  | 'logistics'
  | 'cogs'
  | 'marketing'
  | 'tax'
  | 'profit'
  | 'marginPct';

const COLS: { key: SortKey; label: string; align?: 'left' | 'right' }[] = [
  { key: 'title', label: 'Товар', align: 'left' },
  { key: 'unitsSold', label: 'Шт', align: 'right' },
  { key: 'revenue', label: 'Выручка', align: 'right' },
  { key: 'commission', label: 'Комиссия', align: 'right' },
  { key: 'logistics', label: 'Логистика', align: 'right' },
  { key: 'cogs', label: 'Cogs', align: 'right' },
  { key: 'marketing', label: 'Маркетинг', align: 'right' },
  { key: 'tax', label: 'Налог', align: 'right' },
  { key: 'profit', label: 'Прибыль', align: 'right' },
  { key: 'marginPct', label: 'Маржа %', align: 'right' },
];

export function PnlSkuTable({ rows }: { rows: PnlSkuTableRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDesc, setSortDesc] = useState(true);
  const [query, setQuery] = useState('');
  const [onlyLoss, setOnlyLoss] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let r = rows;
    if (q) r = r.filter((x) => x.title.toLowerCase().includes(q) || (x.myArticle ?? '').toLowerCase().includes(q));
    if (onlyLoss) r = r.filter((x) => x.profit < 0);
    return [...r].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb) : (va as number) - (vb as number);
      return sortDesc ? -cmp : cmp;
    });
  }, [rows, sortKey, sortDesc, query, onlyLoss]);

  const totals = useMemo(() => {
    const acc = filtered.reduce(
      (a, r) => {
        a.unitsSold += r.unitsSold;
        a.revenue += r.revenue;
        a.commission += r.commission;
        a.logistics += r.logistics;
        a.cogs += r.cogs;
        a.marketing += r.marketing;
        a.tax += r.tax;
        a.profit += r.profit;
        return a;
      },
      { unitsSold: 0, revenue: 0, commission: 0, logistics: 0, cogs: 0, marketing: 0, tax: 0, profit: 0 },
    );
    return { ...acc, marginPct: acc.revenue > 0 ? (acc.profit / acc.revenue) * 100 : 0 };
  }, [filtered]);

  const handleSort = (k: SortKey) => {
    if (k === sortKey) setSortDesc((v) => !v);
    else {
      setSortKey(k);
      setSortDesc(true);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="text-base">P&L по товарам</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Поиск по названию или артикулу"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-64 rounded-md border border-border bg-background px-3 text-sm"
          />
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={onlyLoss} onChange={(e) => setOnlyLoss(e.target.checked)} />
            Только убыточные
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {filtered.length} из {rows.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    className={cn('px-2 py-2 font-medium', c.align === 'right' ? 'text-right' : 'text-left', 'cursor-pointer select-none')}
                    onClick={() => handleSort(c.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      <ArrowUpDown className={cn('size-3', sortKey === c.key ? 'text-foreground' : 'opacity-40')} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.skuId} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <SkuThumb src={r.photoUrl} alt={r.title} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium" title={r.title}>{r.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{r.myArticle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.unitsSold.toLocaleString('ru-RU')}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatRub(r.revenue)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatRub(r.commission)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatRub(r.logistics)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatRub(r.cogs)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatRub(r.marketing)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatRub(r.tax)}</td>
                  <td className={cn('px-2 py-1.5 text-right tabular-nums font-medium', r.profit < 0 && 'text-rose-600 dark:text-rose-400')}>{formatRub(r.profit)}</td>
                  <td className={cn('px-2 py-1.5 text-right tabular-nums font-medium', r.marginPct < 0 ? 'text-rose-600 dark:text-rose-400' : r.marginPct >= 25 ? 'text-emerald-600 dark:text-emerald-400' : '')}>
                    {r.marginPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={COLS.length} className="px-2 py-6 text-center text-sm text-muted-foreground">
                    Нет данных по фильтру
                  </td>
                </tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="text-sm font-medium">
                <tr className="border-t-2 border-border">
                  <td className="px-2 py-2">Итого</td>
                  <td className="px-2 py-2 text-right tabular-nums">{totals.unitsSold.toLocaleString('ru-RU')}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatRub(totals.revenue)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatRub(totals.commission)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatRub(totals.logistics)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatRub(totals.cogs)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatRub(totals.marketing)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatRub(totals.tax)}</td>
                  <td className={cn('px-2 py-2 text-right tabular-nums', totals.profit < 0 && 'text-rose-600 dark:text-rose-400')}>{formatRub(totals.profit)}</td>
                  <td className={cn('px-2 py-2 text-right tabular-nums', totals.marginPct < 0 ? 'text-rose-600 dark:text-rose-400' : totals.marginPct >= 25 ? 'text-emerald-600 dark:text-emerald-400' : '')}>
                    {totals.marginPct.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
