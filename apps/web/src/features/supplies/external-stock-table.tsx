'use client';

import { useMemo, useState } from 'react';

export type ExternalStockRow = {
  skuId: number;
  myArticle: string | null;
  barcode: string | null;
  title: string | null;
  home: number;
  ff: number;
};

type Props = { rows: ExternalStockRow[] };

export function ExternalStockTable({ rows: initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState('');
  const [hideZero, setHideZero] = useState(false);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rows.filter((r) => {
      if (hideZero && r.home === 0 && r.ff === 0) return false;
      if (!q) return true;
      return (
        (r.title ?? '').toLowerCase().includes(q) ||
        (r.myArticle ?? '').toLowerCase().includes(q) ||
        (r.barcode ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, filter, hideZero]);

  async function update(skuId: number, location: 'home' | 'ff', quantity: number) {
    const q = Math.max(0, Math.floor(quantity) || 0);
    setRows((prev) => prev.map((r) => (r.skuId === skuId ? { ...r, [location]: q } : r)));
    await fetch('/api/external-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skuId, location, quantity: q }),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Поиск..."
          className="h-9 w-72 rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={hideZero}
            onChange={(e) => setHideZero(e.target.checked)}
            className="h-4 w-4"
          />
          Только с остатком
        </label>
        <span className="ml-auto text-xs text-muted-foreground">{visible.length} из {rows.length}</span>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr className="border-b text-left">
              <th className="px-3 py-2 font-medium">Артикул</th>
              <th className="px-3 py-2 font-medium">Штрихкод</th>
              <th className="px-3 py-2 font-medium">Наименование</th>
              <th className="px-3 py-2 text-right font-medium">Дом</th>
              <th className="px-3 py-2 text-right font-medium">ФФ</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.skuId} className="border-b hover:bg-accent/30">
                <td className="px-3 py-1.5 font-mono text-[11px]">{r.myArticle ?? '—'}</td>
                <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">{r.barcode ?? '—'}</td>
                <td className="max-w-[420px] truncate px-3 py-1.5" title={r.title ?? ''}>{r.title ?? '—'}</td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    value={r.home}
                    onChange={(e) => update(r.skuId, 'home', Number(e.target.value))}
                    className="h-7 w-20 rounded border bg-background px-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    value={r.ff}
                    onChange={(e) => update(r.skuId, 'ff', Number(e.target.value))}
                    className="h-7 w-20 rounded border bg-background px-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
