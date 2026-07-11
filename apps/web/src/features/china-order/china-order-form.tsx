'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2, Check } from 'lucide-react';
import { formatRub } from '@/shared/lib/format';

type ItemRow = {
  supplier_url: string;
  comment: string;
  qty_ordered: string;
  price_yuan: string;
  delivery_yuan: string;
  my_article: string;
  wb_article: string;
  unit_weight_kg: string;
  package_norm: string;
  box_size: string;
};

function emptyRow(): ItemRow {
  return { supplier_url: '', comment: '', qty_ordered: '', price_yuan: '', delivery_yuan: '', my_article: '', wb_article: '', unit_weight_kg: '', package_norm: '', box_size: '' };
}

export function ChinaOrderForm() {
  const router = useRouter();
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [cnyRate, setCnyRate] = useState('11.80');
  const [supplierName, setSupplierName] = useState('');
  const [comment, setComment] = useState('');
  const [items, setItems] = useState<ItemRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ order_id: number; inserted_count: number; cost_history_inserted: number; unmatched_sku_count: number; warnings: string[] } | null>(null);

  const totals = useMemo(() => {
    let qty = 0;
    let yuanTotal = 0;
    let deliveryYuan = 0;
    for (const it of items) {
      const q = Number(it.qty_ordered);
      const p = Number(it.price_yuan);
      const d = Number(it.delivery_yuan);
      if (Number.isFinite(q) && q > 0 && Number.isFinite(p) && p > 0) {
        qty += q;
        yuanTotal += q * p;
      }
      if (Number.isFinite(d) && d > 0) deliveryYuan += d;
    }
    const rate = Number(cnyRate);
    const rubTotal = Number.isFinite(rate) && rate > 0 ? (yuanTotal + deliveryYuan) * rate : 0;
    return { qty, yuanTotal, deliveryYuan, yuanGrand: yuanTotal + deliveryYuan, rubTotal };
  }, [items, cnyRate]);

  function updateItem(i: number, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setItems((rows) => [...rows, emptyRow()]);
  }

  function removeRow(i: number) {
    setItems((rows) => rows.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const payloadItems = items
        .map((it) => ({
          supplier_url: it.supplier_url.trim() || null,
          comment: it.comment.trim() || null,
          qty_ordered: Number(it.qty_ordered),
          price_yuan: Number(it.price_yuan),
          delivery_yuan: it.delivery_yuan ? Number(it.delivery_yuan) : null,
          my_article: it.my_article.trim() || null,
          wb_article: it.wb_article ? Number(it.wb_article) : null,
          unit_weight_kg: it.unit_weight_kg ? Number(it.unit_weight_kg) : null,
          package_norm: it.package_norm ? Number(it.package_norm) : null,
          box_size: it.box_size.trim() || null,
        }))
        .filter((it) => Number.isFinite(it.qty_ordered) && it.qty_ordered > 0 && Number.isFinite(it.price_yuan) && it.price_yuan > 0);
      if (payloadItems.length === 0) throw new Error('Нет валидных позиций');

      const res = await fetch('/api/china-order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_date: orderDate,
          supplier_name: supplierName || undefined,
          cny_rate: Number(cnyRate),
          comment: comment || undefined,
          items: payloadItems,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ошибка');
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-6 py-8">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <Check className="h-5 w-5" />
          <span className="font-medium">Заказ сохранён (#{result.order_id})</span>
        </div>
        <div className="mt-3 text-sm">
          Позиций: <b>{result.inserted_count}</b> · FIFO записей: <b>{result.cost_history_inserted}</b>
          {result.unmatched_sku_count > 0 && <span className="text-amber-700"> · без SKU: {result.unmatched_sku_count}</span>}
        </div>
        {result.warnings.length > 0 && (
          <ul className="mt-2 list-disc pl-6 text-xs text-amber-700">
            {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => { setResult(null); setItems([emptyRow(), emptyRow(), emptyRow()]); }} className="rounded border border-border px-3 py-1.5 text-sm">
            Новый заказ
          </button>
          <button type="button" onClick={() => router.push('/supplies')} className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">
            В «Поставки»
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 rounded-md border bg-card p-4 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Дата заказа</span>
          <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} required className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Курс CNY ₽/¥</span>
          <input type="number" step="0.01" value={cnyRate} onChange={(e) => setCnyRate(e.target.value)} required placeholder="11.80" className="rounded border border-border bg-background px-2 py-1.5 text-sm tabular-nums" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Поставщик</span>
          <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Арина" className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Комментарий</span>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="—" className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
        </label>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th className="w-6"></th>
              <th className="px-2 py-2 text-left">Ссылка 1688</th>
              <th className="px-2 py-2 text-left min-w-[200px]">Комментарий / название</th>
              <th className="px-2 py-2 text-right">Кол-во</th>
              <th className="px-2 py-2 text-right">Цена ¥</th>
              <th className="px-2 py-2 text-right">Доставка ¥</th>
              <th className="px-2 py-2 text-left">Арт. Мой</th>
              <th className="px-2 py-2 text-left">Арт ВБ</th>
              <th className="px-2 py-2 text-right">Вес ед. кг</th>
              <th className="px-2 py-2 text-right">Норма упак.</th>
              <th className="px-2 py-2 text-left">Размер короба</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t align-top">
                <td className="px-1 py-1 text-center text-muted-foreground">{i + 1}</td>
                <td className="px-1 py-1"><input value={it.supplier_url} onChange={(e) => updateItem(i, { supplier_url: e.target.value })} className="w-full min-w-[160px] rounded border border-border bg-background px-1.5 py-1 text-xs" placeholder="https://detail.1688.com/..." /></td>
                <td className="px-1 py-1"><input value={it.comment} onChange={(e) => updateItem(i, { comment: e.target.value })} className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs" /></td>
                <td className="px-1 py-1"><input type="number" value={it.qty_ordered} onChange={(e) => updateItem(i, { qty_ordered: e.target.value })} className="w-16 rounded border border-border bg-background px-1.5 py-1 text-right text-xs tabular-nums" /></td>
                <td className="px-1 py-1"><input type="number" step="0.01" value={it.price_yuan} onChange={(e) => updateItem(i, { price_yuan: e.target.value })} className="w-16 rounded border border-border bg-background px-1.5 py-1 text-right text-xs tabular-nums" /></td>
                <td className="px-1 py-1"><input type="number" step="0.01" value={it.delivery_yuan} onChange={(e) => updateItem(i, { delivery_yuan: e.target.value })} className="w-16 rounded border border-border bg-background px-1.5 py-1 text-right text-xs tabular-nums" /></td>
                <td className="px-1 py-1"><input value={it.my_article} onChange={(e) => updateItem(i, { my_article: e.target.value })} className="w-24 rounded border border-border bg-background px-1.5 py-1 text-xs" /></td>
                <td className="px-1 py-1"><input type="number" value={it.wb_article} onChange={(e) => updateItem(i, { wb_article: e.target.value })} className="w-24 rounded border border-border bg-background px-1.5 py-1 text-xs tabular-nums" /></td>
                <td className="px-1 py-1"><input type="number" step="0.001" value={it.unit_weight_kg} onChange={(e) => updateItem(i, { unit_weight_kg: e.target.value })} className="w-16 rounded border border-border bg-background px-1.5 py-1 text-right text-xs tabular-nums" /></td>
                <td className="px-1 py-1"><input type="number" value={it.package_norm} onChange={(e) => updateItem(i, { package_norm: e.target.value })} className="w-16 rounded border border-border bg-background px-1.5 py-1 text-right text-xs tabular-nums" /></td>
                <td className="px-1 py-1"><input value={it.box_size} onChange={(e) => updateItem(i, { box_size: e.target.value })} className="w-20 rounded border border-border bg-background px-1.5 py-1 text-xs" placeholder="68*36*50" /></td>
                <td className="px-1 py-1"><button type="button" onClick={() => removeRow(i)} className="rounded p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600" aria-label="Удалить"><Trash2 className="h-3 w-3" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-4">
        <button type="button" onClick={addRow} className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm">
          <Plus className="h-3.5 w-3.5" /> Добавить позицию
        </button>
        <div className="flex flex-wrap gap-4 text-xs">
          <div>Кол-во: <b className="tabular-nums">{totals.qty}</b></div>
          <div>Товар ¥: <b className="tabular-nums">{totals.yuanTotal.toFixed(2)}</b></div>
          <div>Доставка ¥: <b className="tabular-nums">{totals.deliveryYuan.toFixed(2)}</b></div>
          <div>Итого ¥: <b className="tabular-nums">{totals.yuanGrand.toFixed(2)}</b></div>
          <div>В рублях: <b className="tabular-nums">{formatRub(totals.rubTotal)}</b></div>
        </div>
        <button type="submit" disabled={saving || totals.qty === 0} className="inline-flex items-center gap-1 rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Сохранить заказ
        </button>
      </div>

      {error && <div className="rounded border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-700">{error}</div>}
    </form>
  );
}
