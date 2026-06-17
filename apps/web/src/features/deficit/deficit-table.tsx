'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { useFiltersStore } from '@/shared/stores/filters';
import type { CsvColumn } from '@/shared/lib/csv';
import { deficitColumns } from './columns';
import type { DeficitRow } from './types';

function matchesSearch(row: DeficitRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    row.name.toLowerCase().includes(needle) ||
    row.barcode.toLowerCase().includes(needle) ||
    (row.myArticle ?? '').toLowerCase().includes(needle) ||
    (row.wbArticle != null ? String(row.wbArticle) : '').includes(needle)
  );
}

const CSV_COLUMNS: CsvColumn<DeficitRow>[] = [
  { key: 'name', label: 'Название' },
  { key: 'barcode', label: 'Штрихкод' },
  { key: 'myArticle', label: 'Мой артикул' },
  { key: 'wbArticle', label: 'Артикул WB' },
  { key: 'channel', label: 'Канал' },
  { key: 'warehouse', label: 'Склад' },
  { key: 'lostRevenue', label: 'Упущено ₽' },
  { key: 'forecastDemand', label: 'Прогноз ₽' },
  { key: 'daysLeft', label: 'Хватит дней' },
  { key: 'toSupply', label: 'К поставке шт' },
  { key: 'dailySales', label: 'Продажи/день' },
  { key: 'stock', label: 'Остаток шт' },
];

export function DeficitTable({ rows }: { rows: DeficitRow[] }) {
  const marketplaces = useFiltersStore((s) => s.marketplaces);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => marketplaces.includes(r.channel))
        .filter((r) => matchesSearch(r, debouncedSearch)),
    [rows, marketplaces, debouncedSearch],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию, артикулу, штрихкоду…"
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Показано {filtered.length} из {rows.length} товаров
          </span>
          <ExportCsvButton rows={filtered} columns={CSV_COLUMNS} filename="deficit" />
        </div>
      </div>
      <DataTable
        data={filtered}
        columns={deficitColumns}
        initialSort={[{ id: 'lostRevenue', desc: true }]}
        rowKey={(row) => row.id}
      />
    </div>
  );
}
