'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { DataTable } from '@/shared/ui/domain/data-table';
import { Button } from '@/shared/ui/button';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { TooltipIcon } from '@/shared/ui/tooltip-icon';
import { cn } from '@/shared/lib/utils';
import type { CostRow, CostHistoryEntry } from '@/entities/costs';

type Props = { rows: CostRow[] };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const costFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

function fmtRub(n: number): string {
  return costFormatter.format(n);
}

function matchesSearch(row: CostRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    row.title.toLowerCase().includes(needle) ||
    row.barcode.toLowerCase().includes(needle) ||
    (row.myArticle ?? '').toLowerCase().includes(needle) ||
    (row.wbArticle != null ? String(row.wbArticle) : '').includes(needle)
  );
}

type EditCellProps = {
  row: CostRow;
  onSaved: () => void;
};

function EditCell({ row, onSaved }: EditCellProps) {
  const [value, setValue] = useState('');
  const [date, setDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const raw = value.replace(',', '.').trim();
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/costs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sku_id: row.sku_id,
          cost_rub: num,
          valid_from: date,
          source: 'manual',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Ошибка: ' + (err.error ?? res.statusText));
      } else {
        setValue('');
        setDate(todayIso());
        onSaved();
      }
    } catch {
      alert('Ошибка сети');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="decimal"
        placeholder="0,00"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <Button size="sm" onClick={save} disabled={!value || saving}>
        {saving ? '...' : 'Сохранить'}
      </Button>
    </div>
  );
}

export function CostsExplorer({ rows }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [historyFor, setHistoryFor] = useState<CostRow | null>(null);
  const [history, setHistory] = useState<CostHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(
    () => rows.filter((r) => matchesSearch(r, debouncedSearch)),
    [rows, debouncedSearch],
  );

  const onSaved = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  const openHistory = useCallback(async (row: CostRow) => {
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
  }, []);

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const isXlsx = /\.xlsx$/i.test(file.name);
      let entries: { barcode: string; cost_rub: number; valid_from: string; source: string }[] = [];

      if (isXlsx) {
        const form = new FormData();
        form.append('file', file);
        const parseRes = await fetch('/api/costs/parse-xlsx', { method: 'POST', body: form });
        if (!parseRes.ok) {
          const err = await parseRes.json().catch(() => ({}));
          setImportResult('Ошибка чтения XLSX: ' + (err.error ?? parseRes.statusText));
          return;
        }
        const parsed = await parseRes.json();
        entries = parsed.entries ?? [];
      } else {
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
        for (let i = 1; i < lines.length; i++) {
          const parts = (lines[i] ?? '').split(';');
          const barcode = (parts[bcIdx] ?? '').trim();
          const cost = Number((parts[costIdx] ?? '').replace(',', '.').trim());
          const date = (parts[dateIdx] ?? '').trim();
          if (!barcode || !Number.isFinite(cost) || !date) continue;
          entries.push({ barcode, cost_rub: cost, valid_from: date, source: 'csv' });
        }
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
      {
        accessorKey: 'title',
        header: 'Товар',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <SkuThumb src={row.original.photo_url} alt={row.original.title} />
            <div className="flex flex-col">
              <span className="line-clamp-2">{row.original.title}</span>
              <span className="text-xs text-muted-foreground">
                {row.original.myArticle ?? (row.original.wbArticle != null ? String(row.original.wbArticle) : '—')}
              </span>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'current_cost',
        header: () => (
          <span className="inline-flex items-center gap-1">
            Текущая cost (₽)
            <TooltipIcon text="Себестоимость товара, действующая на сегодняшний день. Берётся из последней актуальной записи истории, либо из карточки SKU, если истории ещё нет." />
          </span>
        ),
        cell: (info) => {
          const value = info.getValue<number>();
          if (!value) {
            return <span className="text-xs text-muted-foreground">нет данных</span>;
          }
          return <span className="tabular-nums">{fmtRub(value)}</span>;
        },
      },
      {
        accessorKey: 'valid_from',
        header: 'Действует с',
        cell: (info) => <span className="text-muted-foreground tabular-nums">{info.getValue<string | null>() ?? '—'}</span>,
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
        cell: ({ row }) => <EditCell row={row.original} onSaved={onSaved} />,
      },
    ],
    [openHistory, onSaved],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative w-full min-w-[220px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по артикулу, штрихкоду, названию…"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Показано: <span className="font-medium text-foreground tabular-nums">{filtered.length}</span> из{' '}
            <span className="font-medium text-foreground tabular-nums">{rows.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {importResult && <span className="text-xs text-muted-foreground">{importResult}</span>}
          <Button variant="ghost" size="sm" asChild>
            <a href="/api/costs/template-xlsx" download>
              Шаблон Excel
            </a>
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
            {importing ? 'Импорт...' : 'Импорт Excel/CSV'}
          </Button>
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(r) => String(r.sku_id)}
        rowClassName={(r) => (!r.current_cost ? 'bg-muted/20' : undefined)}
        className="max-h-[70vh] overflow-auto"
        empty="Нет данных"
      />

      <p className="text-xs text-muted-foreground">
        Шаблон Excel — со столбцами <code>barcode</code>, <code>cost</code>, <code>valid_from</code>.
        Заполни и загрузи через «Импорт Excel/CSV». Принимаются и .xlsx, и .csv (с разделителем «;»).
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
                <div className="p-6 text-center text-sm text-muted-foreground">Нет данных</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
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
                        <td className={cn('px-4 py-2 tabular-nums', !h.valid_to && 'font-medium text-foreground')}>{h.valid_from}</td>
                        <td className="px-4 py-2 text-muted-foreground tabular-nums">{h.valid_to ?? 'актуальна'}</td>
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
