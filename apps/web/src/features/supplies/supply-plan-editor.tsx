'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Download, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { TooltipIcon } from '@/shared/ui/tooltip-icon';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { cn } from '@/shared/lib/utils';
import { formatInt } from '@/shared/lib/format';
import { wbPhotoUrl } from '@/shared/lib/wb-photo';
import {
  SUPPLY_PLAN_STATUSES,
  SUPPLY_PLAN_STATUS_LABEL,
  type SupplyPlanStatus,
} from '@/entities/supplies';

const RECOMMEND_TOOLTIP =
  'Рекомендация: продажи за 60 дней / 60 × 30 дней − остаток на складе WB − доля от (дом + ФФ).';

export type SupplyEditorSupplier = {
  id: number;
  name: string;
  link: string;
  priceCny: number | null;
  isDefault: boolean;
};

export type SupplyEditorRow = {
  skuId: number;
  myArticle: string | null;
  wbArticle: number | null;
  barcode: string | null;
  title: string | null;
  salesByWarehouse: Record<string, number>;
  stocksByWarehouse: Record<string, number>;
  homeStock: number;
  ffStock: number;
  recommendByWarehouse: Record<string, number>;
  suppliers: SupplyEditorSupplier[];
  // существующие значения из плана (для редактирования):
  qtyByWarehouse: Record<string, number>;
  selectedSupplierId: number | null;
  chinaQty: number;
};

type Props = {
  planId: number | null; // null = new
  initialName: string;
  initialStatus: SupplyPlanStatus;
  initialNotes: string;
  warehouses: string[];
  rows: SupplyEditorRow[];
};

const TARGET_DAYS = 30;
const SALES_WINDOW_DAYS = 60;

function recomputeRow(
  sales: Record<string, number>,
  stocks: Record<string, number>,
  home: number,
  ff: number,
): Record<string, number> {
  const ws = Object.keys(sales);
  let total = 0;
  for (const w of ws) total += sales[w] ?? 0;
  const ext = (home || 0) + (ff || 0);
  const out: Record<string, number> = {};
  for (const w of ws) {
    const sv = sales[w] ?? 0;
    const st = stocks[w] ?? 0;
    const v = sv / SALES_WINDOW_DAYS;
    const share = total > 0 ? sv / total : 0;
    const need = v * TARGET_DAYS - st - share * ext;
    out[w] = need > 0 ? Math.ceil(need) : 0;
  }
  return out;
}

export function SupplyPlanEditor({
  planId,
  initialName,
  initialStatus,
  initialNotes,
  warehouses,
  rows: initialRows,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<SupplyPlanStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [rows, setRows] = useState<SupplyEditorRow[]>(initialRows);
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openSupplierFor, setOpenSupplierFor] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(filter), 250);
    return () => clearTimeout(t);
  }, [filter]);

  const visibleRows = useMemo(() => {
    const q = debouncedFilter.trim().toLowerCase();
    return rows.filter((r) => {
      if (hideZero) {
        const sum = Object.values(r.qtyByWarehouse).reduce((a, b) => a + b, 0);
        if (sum === 0) return false;
      }
      if (!q) return true;
      return (
        (r.title ?? '').toLowerCase().includes(q) ||
        (r.myArticle ?? '').toLowerCase().includes(q) ||
        (r.barcode ?? '').toLowerCase().includes(q) ||
        String(r.wbArticle ?? '').includes(q)
      );
    });
  }, [rows, debouncedFilter, hideZero]);

  function patchRow(skuId: number, fn: (r: SupplyEditorRow) => SupplyEditorRow) {
    setRows((prev) => prev.map((r) => (r.skuId === skuId ? fn(r) : r)));
  }

  function updateHome(skuId: number, v: number) {
    patchRow(skuId, (r) => {
      const home = Math.max(0, Math.floor(v) || 0);
      const recommend = recomputeRow(r.salesByWarehouse, r.stocksByWarehouse, home, r.ffStock);
      const qtyByWarehouse = { ...r.qtyByWarehouse };
      // refresh suggestions only where user hasn't typed (qty=0 → take recommend)
      for (const w of warehouses) if ((qtyByWarehouse[w] ?? 0) === 0) qtyByWarehouse[w] = recommend[w] ?? 0;
      return { ...r, homeStock: home, recommendByWarehouse: recommend, qtyByWarehouse };
    });
    // fire-and-forget upsert
    fetch('/api/external-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skuId, location: 'home', quantity: v }),
    }).catch(() => {});
  }
  function updateFf(skuId: number, v: number) {
    patchRow(skuId, (r) => {
      const ff = Math.max(0, Math.floor(v) || 0);
      const recommend = recomputeRow(r.salesByWarehouse, r.stocksByWarehouse, r.homeStock, ff);
      const qtyByWarehouse = { ...r.qtyByWarehouse };
      for (const w of warehouses) if ((qtyByWarehouse[w] ?? 0) === 0) qtyByWarehouse[w] = recommend[w] ?? 0;
      return { ...r, ffStock: ff, recommendByWarehouse: recommend, qtyByWarehouse };
    });
    fetch('/api/external-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skuId, location: 'ff', quantity: v }),
    }).catch(() => {});
  }
  function updateQty(skuId: number, w: string, v: number) {
    patchRow(skuId, (r) => {
      const qtyByWarehouse = { ...r.qtyByWarehouse, [w]: Math.max(0, Math.floor(v) || 0) };
      return { ...r, qtyByWarehouse };
    });
  }
  function setSupplier(skuId: number, supplierId: number | null) {
    patchRow(skuId, (r) => ({ ...r, selectedSupplierId: supplierId }));
    setOpenSupplierFor(null);
  }
  function updateChinaQty(skuId: number, v: number) {
    patchRow(skuId, (r) => ({ ...r, chinaQty: Math.max(0, Math.floor(v) || 0) }));
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError('Введите название поставки');
      return;
    }
    startTransition(async () => {
      try {
        let id = planId;
        if (id == null) {
          const res = await fetch('/api/supplies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), status, notes }),
          });
          const json = await res.json();
          if (!res.ok || !json.plan) throw new Error(json.error ?? 'create_failed');
          id = json.plan.id as number;
        } else {
          const res = await fetch('/api/supplies', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name: name.trim(), status, notes }),
          });
          if (!res.ok) throw new Error('update_failed');
        }

        // items
        const items: { skuId: number; warehouseName: string; qty: number }[] = [];
        for (const r of rows) {
          for (const w of warehouses) {
            const q = r.qtyByWarehouse[w] ?? 0;
            if (q > 0) items.push({ skuId: r.skuId, warehouseName: w, qty: q });
          }
        }
        const r1 = await fetch('/api/supplies/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: id, items }),
        });
        if (!r1.ok) throw new Error('items_save_failed');

        // china
        const chinaItems = rows
          .filter((r) => r.chinaQty > 0)
          .map((r) => {
            const sup = r.suppliers.find((s) => s.id === r.selectedSupplierId);
            return {
              skuId: r.skuId,
              supplierId: r.selectedSupplierId,
              qty: r.chinaQty,
              priceCny: sup?.priceCny ?? null,
            };
          });
        const r2 = await fetch('/api/supplies/china', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: id, items: chinaItems }),
        });
        if (!r2.ok) throw new Error('china_save_failed');

        if (planId == null) {
          router.push(`/supplies/${id}`);
        } else {
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'save_failed');
      }
    });
  }

  async function handleDelete() {
    if (planId == null) return;
    if (!confirm('Удалить поставку?')) return;
    const res = await fetch(`/api/supplies?id=${planId}`, { method: 'DELETE' });
    if (res.ok) router.push('/supplies');
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Шапка: название + статус + notes */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название поставки"
            className="h-9 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SupplyPlanStatus)}
            className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          >
            {SUPPLY_PLAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SUPPLY_PLAN_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Заметки (опционально)"
          className="min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        {error && <p className="text-xs text-rose-500">{error}</p>}
      </div>

      {/* Тулбар */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Поиск по артикулу / штрихкоду / названию..."
          className="h-9 w-72 rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={hideZero}
            onChange={(e) => setHideZero(e.target.checked)}
            className="h-4 w-4"
          />
          Скрыть пустые строки
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4" />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
          {planId != null && (
            <>
              <Button variant="outline" asChild>
                <a href={`/api/supplies/${planId}/ff-xlsx`} download>
                  <Download className="size-4" /> ФФ-шаблон
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={`/api/supplies/${planId}/china-xlsx`} download>
                  <Download className="size-4" /> Заказ 1688
                </a>
              </Button>
              <Button variant="destructive" size="icon" onClick={handleDelete} title="Удалить поставку">
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Таблица */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1400px] text-xs">
          <thead className="sticky top-0 z-10 bg-muted/50 backdrop-blur">
            <tr className="border-b text-left">
              <th rowSpan={2} className="sticky left-0 z-20 bg-muted/50 px-2 py-2 font-medium text-foreground">
                Артикул
              </th>
              <th rowSpan={2} className="px-2 py-2 font-medium">Штрихкод</th>
              <th rowSpan={2} className="px-2 py-2 font-medium">Наименование</th>
              <th colSpan={warehouses.length} className="border-l px-2 py-2 text-center font-medium text-blue-700 dark:text-blue-400">
                Продано за 60 дней
              </th>
              <th colSpan={warehouses.length + 2} className="border-l px-2 py-2 text-center font-medium text-emerald-700 dark:text-emerald-400">
                Остатки
              </th>
              <th colSpan={warehouses.length} className="border-l px-2 py-2 text-center font-medium text-fuchsia-700 dark:text-fuchsia-400">
                <span className="inline-flex items-center gap-1">
                  Везти
                  <TooltipIcon text={RECOMMEND_TOOLTIP} />
                </span>
              </th>
              <th rowSpan={2} className="border-l px-2 py-2 text-center font-medium">Итого</th>
              <th rowSpan={2} className="border-l px-2 py-2 font-medium">Поставщик 1688</th>
              <th rowSpan={2} className="px-2 py-2 font-medium">Заказ на 1688</th>
            </tr>
            <tr className="border-b text-[10px] text-muted-foreground">
              {warehouses.map((w) => (
                <th key={`s-${w}`} className="border-l px-2 py-1 font-normal">{w}</th>
              ))}
              {warehouses.map((w) => (
                <th key={`st-${w}`} className="border-l px-2 py-1 font-normal">{w}</th>
              ))}
              <th className="border-l px-2 py-1 font-normal">Дом</th>
              <th className="border-l px-2 py-1 font-normal">ФФ</th>
              {warehouses.map((w) => (
                <th key={`q-${w}`} className="border-l px-2 py-1 font-normal">{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={8 + warehouses.length * 3}
                  className="px-2 py-10 text-center text-muted-foreground"
                >
                  Нет данных
                </td>
              </tr>
            ) : (
            visibleRows.map((r) => {
              const total = warehouses.reduce((a, w) => a + (r.qtyByWarehouse[w] ?? 0), 0);
              const selected = r.suppliers.find((s) => s.id === r.selectedSupplierId);
              const defaultSup = r.suppliers.find((s) => s.isDefault) ?? r.suppliers[0];
              const sup = selected ?? defaultSup;
              const photoUrl = wbPhotoUrl(r.wbArticle);
              return (
                <tr key={r.skuId} className="border-b text-xs hover:bg-accent/30">
                  <td className="sticky left-0 z-10 bg-card px-2 py-1 font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                      <SkuThumb src={photoUrl} alt={r.title ?? ''} />
                      <span>{r.myArticle ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1 font-mono text-[11px] text-muted-foreground">{r.barcode ?? '—'}</td>
                  <td className="max-w-[260px] truncate px-2 py-1" title={r.title ?? ''}>
                    {r.title ?? '—'}
                  </td>
                  {/* блок 1: продажи 60д */}
                  {warehouses.map((w) => (
                    <td
                      key={`s-${r.skuId}-${w}`}
                      className="border-l bg-blue-500/5 px-2 py-1 text-right tabular-nums text-muted-foreground"
                    >
                      {formatInt(r.salesByWarehouse[w] ?? 0)}
                    </td>
                  ))}
                  {/* блок 2: остатки */}
                  {warehouses.map((w) => {
                    const st = r.stocksByWarehouse[w] ?? 0;
                    return (
                      <td
                        key={`st-${r.skuId}-${w}`}
                        className={cn(
                          'border-l px-2 py-1 text-right tabular-nums',
                          st === 0
                            ? 'bg-rose-500/5 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-500/5 text-muted-foreground',
                        )}
                      >
                        {formatInt(st)}
                      </td>
                    );
                  })}
                  <td className="border-l bg-emerald-500/10 px-1 py-1">
                    <input
                      type="number"
                      value={r.homeStock}
                      onChange={(e) => updateHome(r.skuId, Number(e.target.value))}
                      className="h-7 w-16 rounded border bg-background px-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td className="border-l bg-emerald-500/10 px-1 py-1">
                    <input
                      type="number"
                      value={r.ffStock}
                      onChange={(e) => updateFf(r.skuId, Number(e.target.value))}
                      className="h-7 w-16 rounded border bg-background px-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  {/* блок 3: везти */}
                  {warehouses.map((w) => {
                    const qty = r.qtyByWarehouse[w] ?? 0;
                    const rec = r.recommendByWarehouse[w] ?? 0;
                    const isRecommend = qty === rec && qty > 0;
                    return (
                      <td key={`q-${r.skuId}-${w}`} className={cn('border-l px-1 py-1', qty > 0 ? 'bg-fuchsia-500/10' : '')}>
                        <input
                          type="number"
                          value={qty}
                          onChange={(e) => updateQty(r.skuId, w, Number(e.target.value))}
                          className={cn(
                            'h-7 w-16 rounded border bg-background px-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring',
                            isRecommend && 'text-fuchsia-700 dark:text-fuchsia-400',
                          )}
                          title={`Рекомендация: ${rec}`}
                        />
                      </td>
                    );
                  })}
                  <td className="border-l px-2 py-1 text-right font-mono tabular-nums">
                    {total > 0 ? (
                      <span className="font-medium">{formatInt(total)}</span>
                    ) : (
                      <span className="text-muted-foreground">{formatInt(0)}</span>
                    )}
                  </td>
                  {/* поставщик */}
                  <td className="relative border-l px-2 py-1">
                    {r.suppliers.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground">нет</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenSupplierFor(openSupplierFor === r.skuId ? null : r.skuId)}
                        className="inline-flex items-center gap-1 rounded border bg-background px-2 py-1 text-[11px] hover:bg-accent"
                      >
                        <span className="max-w-[120px] truncate">{sup?.name ?? 'Выбрать'}</span>
                        {sup?.isDefault && <Badge variant="outline" className="px-1 py-0 text-[9px]">по умолч.</Badge>}
                        <ChevronDown className="size-3" />
                      </button>
                    )}
                    {openSupplierFor === r.skuId && r.suppliers.length > 0 && (
                      <div className="absolute right-2 top-full z-30 mt-1 w-72 rounded-md border bg-popover p-1 shadow-md">
                        {r.suppliers.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSupplier(r.skuId, s.id)}
                            className={cn(
                              'flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left text-[11px] hover:bg-accent',
                              r.selectedSupplierId === s.id && 'bg-accent',
                            )}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="font-medium">{s.name}</span>
                              {s.priceCny != null && <span className="font-mono text-muted-foreground">¥{s.priceCny}</span>}
                            </span>
                            <span className="truncate text-[10px] text-muted-foreground">{s.link}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  {/* china qty */}
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      value={r.chinaQty}
                      onChange={(e) => updateChinaQty(r.skuId, Number(e.target.value))}
                      className="h-7 w-16 rounded border bg-background px-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Рекомендация: продажи/60 × 30 − остаток WB − доля от (дом + ФФ). Колонка «Везти» автозаполнена;
        правьте вручную где нужно.
      </p>
    </div>
  );
}
