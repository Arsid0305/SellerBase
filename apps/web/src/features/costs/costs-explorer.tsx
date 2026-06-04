'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/shared/ui/domain/data-table';
import { Button } from '@/shared/ui/button';
import type { CostRow, CostHistoryEntry } from '@/entities/costs';

type Props = { rows: CostRow[] };

type RowState = { value: string; saving: boolean };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtRub(n: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n);
}

export function CostsExplorer({ rows }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, setState] = useState<Record<number, RowState>>({});
  const [historyFor, setHistoryFor] = useState<CostRow | null>(null);
  const [history, setHistory] = useState<CostHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateRow = (id: number, patch: Partial<RowState>) => {
    setState((s) => ({ ...s, [id]: { value: '', saving: false, ...s[id], ...patch } }));
  };

  const save = async (row: CostRow) => {
    const cur = state[row.sku_id];
    const raw = (cur?.value ?? '').replace(',', '.').trim();
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return;
    updateRow(row.sku_id, { saving: true });
    try {
      const res = await fetch('/api/costs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sku_id: row.sku_id,
          cost_rub: num,
          valid_from: todayIso(),
          source: 'manual',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Ошибка: ' + (err.error ?? res.statusText));
      } else {
        updateRow(row.sku_id, { value: '', saving: false });
        startTransition(() => router.refresh());
        return;
      }
    } catch (e) {
      alert('Ошибка сети');
    }
    updateRow(row.sku_id, { saving: false });
  };

  const openHistory = async (row: CostRow) => {
    setHistoryFor(row);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/costs/history?sku_id=${row.sku_id}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.entries ?? []);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      let text = await file.text();
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        setImportResult('Пустой файл');
        return;
      }
      const header = (lines[0] ?? '').split(';').map((s) => s.trim().toLowerCase());
      const bcIdx = header.indexOf('barcode');
      const costIdx = header.indexOf('cost');
      const dateIdx = header.indexOf('valid_from');
      if (bcIdx < 0 || costIdx < 0 || dateIdx < 0) {
        setImportResult('Ожидаемые колонки: barcode;cost;valid_from');
        return;
      }
      const entries: { barcode: string; cost_rub: number; valid_from: string; source: string }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = (lines[i] ?? '').split(';');
        const barcode = (parts[bcIdx] ?? '').trim();
        const cost = Number((parts[costIdx] ?? '').replace(',', '.').trim());
        const date = (parts[dateIdx] ?? '').trim();
        if (!barcode || !Number.isFinite(cost) || !date) continue;
        entries.push({ barcode, cost_rub: cost, valid_from: date, source: 'csv' });
      }
      if (entries.length === 0) {
        setImportResult('Не нашёл валидных строк');
        return;
      }
      const res = await fetch('/api/costs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportResult('Ошибка: ' + (data.error ?? res.statusText));
      } else {
        setImportResult(`Импортировано: ${data.inserted}, пропущено: ${(data.skipped ?? []).length}`);
        startTransition(() => router.refresh());
      }
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const columns = useMemo<ColumnDef<CostRow>[]>(
    () => [
      { accessorKey: 'barcode', header: 'Штрихкод', cell: (info) => <span className="font-mono text-xs">{info.getValue<string>() || '—'}</span> },
      { accessorKey: 'title', header: 'Товар', cell: (info) => <span className="line-clamp-2">{info.getValue<string>()}</span> },
      {
        accessorKey: 'current_cost',
        header: 'Текущая cost (₽)',
        cell: (info) => <span className="tabular-nums">{fmtRub(info.getValue<number>())}</span>,
      },
      {
        accessorKey: 'valid_from',
        header: 'Действует с',
        cell: (info) => <span className="text-muted-foreground">{info.getValue<string | null>() ?? '—'}</span>,
      },
      {
        id: 'history',
        header: 'История',
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => openHistory(row.original)}>
            История
          </Button>
        ),
      },
      {
        id: 'edit',
        header: 'Новое значение',
        cell: ({ row }) => {
          const r = row.original;
          const s = state[r.sku_id];
          return (
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={s?.value ?? ''}
                onChange={(e) => updateRow(r.sku_id, { value: e.target.value })}
                className="h-8 w-24 rounded-md border border-input bg-background px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button
                size="sm"
                onClick={() => save(r)}
                disabled={!s?.value || s?.saving}
              >
                {s?.saving ? '...' : 'Сохранить'}
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Всего SKU: <span className="font-medium text-foreground">{rows.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {importResult && <span className="text-xs text-muted-foreground">{importResult}</span>}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Импорт...' : 'Импорт CSV'}
          </Button>
        </div>
      </div>

      <DataTable data={rows} columns={columns} rowKey={(r) => String(r.sku_id)} />

      <p className="text-xs text-muted-foreground">
        Формат CSV: <code>barcode;cost;valid_from</code> (разделитель «;», UTF-8). Дата в формате YYYY-MM-DD.
      </p>

      {historyFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setHistoryFor(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold">История себестоимости</h3>
                <p className="text-xs text-muted-foreground line-clamp-1">{historyFor.title}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setHistoryFor(null)}>
                ✕
              </Button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {historyLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Загрузка...</div>
              ) : history.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Записей нет</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Cost (₽)</th>
                      <th className="px-4 py-2 text-left">С</th>
                      <th className="px-4 py-2 text-left">По</th>
                      <th className="px-4 py-2 text-left">Источник</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-2 tabular-nums">{fmtRub(Number(h.cost_rub))}</td>
                        <td className="px-4 py-2">{h.valid_from}</td>
                        <td className="px-4 py-2 text-muted-foreground">{h.valid_to ?? 'актуальна'}</td>
                        <td className="px-4 py-2 text-muted-foreground">{h.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
