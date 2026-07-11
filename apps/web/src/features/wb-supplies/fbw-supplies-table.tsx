'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatRub, formatInt } from '@/shared/lib/format';
import type { FbwSupplyRow, SupplyInvoice } from '@/entities/wb-supplies';

type Props = {
  rows: FbwSupplyRow[];
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function FbwSuppliesTable({ rows }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-card/40 px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">FBW-поставок ещё нет.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Появятся автоматически после ночного cron <code>fetch-wb-supplies</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
          <tr>
            <th className="w-8"></th>
            <th className="px-3 py-2 text-left">Поставка</th>
            <th className="px-3 py-2 text-left">Склад</th>
            <th className="px-3 py-2 text-left">Статус</th>
            <th className="px-3 py-2 text-right">Дата</th>
            <th className="px-3 py-2 text-right">Коробки</th>
            <th className="px-3 py-2 text-right">Единиц</th>
            <th className="px-3 py-2 text-right">Счета ФФ</th>
            <th className="px-3 py-2 text-right">Дост./ед.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const open = expanded === r.supplyId;
            return (
              <>
                <tr key={r.supplyId} className={cn('border-t transition-colors', open && 'bg-muted/20')}>
                  <td className="px-2">
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : r.supplyId)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted"
                      aria-label={open ? 'Свернуть' : 'Развернуть'}
                    >
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name ?? r.supplyId}</div>
                    <div className="text-xs text-muted-foreground">{r.supplyId}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.warehouseName ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{r.status ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtDate(r.dateCreated)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatInt(r.boxesCount ?? 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatInt(r.unitsTotal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.invoiceTotalRub > 0 ? formatRub(r.invoiceTotalRub) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {r.deliveryPerUnitRub != null ? formatRub(r.deliveryPerUnitRub) : '—'}
                  </td>
                </tr>
                {open && (
                  <tr key={`${r.supplyId}-panel`} className="border-t bg-muted/10">
                    <td colSpan={9} className="px-4 py-3">
                      <InvoicesPanel supplyId={r.supplyId} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InvoicesPanel({ supplyId }: { supplyId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [invoices, setInvoices] = useState<SupplyInvoice[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ invoice_number: '', invoice_date: new Date().toISOString().slice(0, 10), amount_rub: '', ff_name: '', comment: '' });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/supplies/invoices?supply_id=${encodeURIComponent(supplyId)}`);
      if (res.ok) {
        const json = await res.json();
        setInvoices(json.rows ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  if (invoices === null && !loading) load();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/supplies/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supply_id: supplyId,
          invoice_number: form.invoice_number || undefined,
          invoice_date: form.invoice_date,
          amount_rub: Number(form.amount_rub),
          ff_name: form.ff_name || undefined,
          comment: form.comment || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setForm((f) => ({ ...f, invoice_number: '', amount_rub: '', comment: '' }));
      await load();
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ошибка');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('Удалить счёт?')) return;
    const res = await fetch(`/api/supplies/invoices?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      await load();
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-medium text-muted-foreground">Счета от ФФ по этой поставке</div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> загрузка…
        </div>
      ) : invoices && invoices.length > 0 ? (
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left">Дата</th>
              <th className="text-left">Номер</th>
              <th className="text-left">ФФ</th>
              <th className="text-right">Сумма</th>
              <th className="text-left">Заметка</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((iv) => (
              <tr key={iv.id} className="border-t">
                <td className="py-1 tabular-nums">{fmtDate(iv.invoiceDate)}</td>
                <td className="py-1">{iv.invoiceNumber ?? '—'}</td>
                <td className="py-1">{iv.ffName ?? '—'}</td>
                <td className="py-1 text-right tabular-nums">{formatRub(iv.amountRub)}</td>
                <td className="py-1 text-muted-foreground">{iv.comment ?? ''}</td>
                <td className="py-1 text-right">
                  <button
                    type="button"
                    onClick={() => remove(iv.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Удалить"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-xs text-muted-foreground">Счетов ещё нет. Добавь ниже.</div>
      )}

      <form onSubmit={save} className="grid grid-cols-2 gap-2 rounded border border-border bg-background p-3 sm:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Дата</span>
          <input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} required className="rounded border border-border bg-background px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Номер</span>
          <input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} placeholder="—" className="rounded border border-border bg-background px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">ФФ</span>
          <input value={form.ff_name} onChange={(e) => setForm({ ...form, ff_name: e.target.value })} placeholder="—" className="rounded border border-border bg-background px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Сумма ₽</span>
          <input type="number" step="0.01" value={form.amount_rub} onChange={(e) => setForm({ ...form, amount_rub: e.target.value })} required placeholder="0" className="rounded border border-border bg-background px-2 py-1 text-sm tabular-nums" />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Заметка</span>
          <input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="—" className="rounded border border-border bg-background px-2 py-1 text-sm" />
        </label>
        <div className="col-span-2 flex items-center gap-3 sm:col-span-6">
          <button type="submit" disabled={saving || pending} className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
            {saving || pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Добавить счёт
          </button>
          {error && <span className="text-xs text-rose-600">{error}</span>}
        </div>
      </form>
    </div>
  );
}
