'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Star, Trash2, Pencil, Check, X, ExternalLink } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import type { ChinaSupplier } from '@/entities/suppliers';

type Props = {
  skuId: number;
  initial: ChinaSupplier[];
};

type Draft = {
  supplierName: string;
  link1688: string;
  priceCny: string;
  notes: string;
  isDefault: boolean;
};

const emptyDraft: Draft = { supplierName: '', link1688: '', priceCny: '', notes: '', isDefault: false };

export function SuppliersCard({ skuId, initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<ChinaSupplier[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function startEdit(s: ChinaSupplier) {
    setEditingId(s.id);
    setEditDraft({
      supplierName: s.supplierName,
      link1688: s.link1688,
      priceCny: s.priceCny != null ? String(s.priceCny) : '',
      notes: s.notes ?? '',
      isDefault: s.isDefault,
    });
  }

  async function handleAdd() {
    setError(null);
    if (!draft.supplierName.trim() || !draft.link1688.trim()) {
      setError('Заполните название и ссылку');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skuId,
          supplierName: draft.supplierName.trim(),
          link1688: draft.link1688.trim(),
          priceCny: draft.priceCny ? Number(draft.priceCny) : null,
          notes: draft.notes || null,
          isDefault: draft.isDefault,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.supplier) {
        setError(json.error ?? 'create_failed');
        return;
      }
      setItems((prev) => {
        let next = prev;
        if (json.supplier.isDefault) next = next.map((p) => ({ ...p, isDefault: false }));
        return [...next, json.supplier as ChinaSupplier];
      });
      setDraft(emptyDraft);
      setShowForm(false);
      router.refresh();
    });
  }

  async function handleSaveEdit(id: number) {
    startTransition(async () => {
      const res = await fetch('/api/suppliers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          supplierName: editDraft.supplierName.trim(),
          link1688: editDraft.link1688.trim(),
          priceCny: editDraft.priceCny ? Number(editDraft.priceCny) : null,
          notes: editDraft.notes || null,
          isDefault: editDraft.isDefault,
        }),
      });
      const json = await res.json();
      if (!res.ok) return;
      setItems((prev) => {
        let next = prev.map((p) => (p.id === id ? (json.supplier as ChinaSupplier) : p));
        if (json.supplier?.isDefault) next = next.map((p) => (p.id === id ? p : { ...p, isDefault: false }));
        return next;
      });
      setEditingId(null);
      router.refresh();
    });
  }

  async function handleDelete(id: number) {
    if (!confirm('Удалить поставщика?')) return;
    startTransition(async () => {
      const res = await fetch(`/api/suppliers?id=${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      setItems((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    });
  }

  async function handleSetDefault(id: number) {
    startTransition(async () => {
      const res = await fetch('/api/suppliers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isDefault: true }),
      });
      if (!res.ok) return;
      setItems((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Поставщики 1688</h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)} disabled={busy}>
          <Plus className="size-4" />
          Добавить
        </Button>
      </div>

      {showForm && (
        <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
          <input
            value={draft.supplierName}
            onChange={(e) => setDraft({ ...draft, supplierName: e.target.value })}
            placeholder="Название поставщика"
            className="h-8 rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            value={draft.link1688}
            onChange={(e) => setDraft({ ...draft, link1688: e.target.value })}
            placeholder="Ссылка 1688"
            className="h-8 rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={draft.priceCny}
              onChange={(e) => setDraft({ ...draft, priceCny: e.target.value })}
              placeholder="Цена ¥"
              className="h-8 w-24 rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Заметки"
              className="h-8 flex-1 rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={draft.isDefault}
              onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
              className="h-4 w-4"
            />
            По умолчанию
          </label>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setDraft(emptyDraft); setError(null); }}>
              Отмена
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={busy}>
              Сохранить
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Поставщиков нет. Добавьте первого.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((s) =>
            editingId === s.id ? (
              <div key={s.id} className="flex flex-col gap-2 rounded-lg border bg-background p-3">
                <input
                  value={editDraft.supplierName}
                  onChange={(e) => setEditDraft({ ...editDraft, supplierName: e.target.value })}
                  className="h-8 rounded border bg-background px-2 text-xs"
                />
                <input
                  value={editDraft.link1688}
                  onChange={(e) => setEditDraft({ ...editDraft, link1688: e.target.value })}
                  className="h-8 rounded border bg-background px-2 text-xs"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={editDraft.priceCny}
                    onChange={(e) => setEditDraft({ ...editDraft, priceCny: e.target.value })}
                    placeholder="Цена ¥"
                    className="h-8 w-24 rounded border bg-background px-2 text-xs"
                  />
                  <input
                    value={editDraft.notes}
                    onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                    placeholder="Заметки"
                    className="h-8 flex-1 rounded border bg-background px-2 text-xs"
                  />
                </div>
                <div className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} title="Отмена">
                    <X className="size-4" />
                  </Button>
                  <Button size="icon" onClick={() => handleSaveEdit(s.id)} disabled={busy} title="Сохранить">
                    <Check className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2 text-xs"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.supplierName}</span>
                    {s.isDefault && (
                      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-700 dark:text-amber-400">
                        по умолчанию
                      </Badge>
                    )}
                    {s.priceCny != null && (
                      <span className="font-mono text-[11px] text-muted-foreground">¥{s.priceCny}</span>
                    )}
                  </div>
                  <a
                    href={s.link1688}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 truncate text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-3 shrink-0" />
                    <span className="truncate">{s.link1688}</span>
                  </a>
                  {s.notes && <span className="text-[11px] text-muted-foreground">{s.notes}</span>}
                </div>
                <div className="flex items-center gap-1">
                  {!s.isDefault && (
                    <Button size="icon" variant="ghost" onClick={() => handleSetDefault(s.id)} title="Сделать по умолчанию">
                      <Star className="size-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => startEdit(s)} title="Редактировать">
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)} title="Удалить">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
