'use client';

import { useMemo, useState } from 'react';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import type { CsvColumn } from '@/shared/lib/csv';
import { queriesColumns } from './queries-columns';
import type { SearchQuery } from './types';

const CSV_COLUMNS: CsvColumn<SearchQuery>[] = [
  { key: 'text', label: 'Запрос' },
  { key: 'frequency', label: 'Частотность / день' },
  { key: 'competitorCount', label: 'Товаров в выдаче' },
  { key: 'avgCpc', label: 'Средний CPC ₽' },
];

export function QueriesTable({ queries }: { queries: SearchQuery[] }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return queries;
    return queries.filter((x) => x.text.toLowerCase().includes(q));
  }, [queries, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Поисковые запросы</h2>
        <ExportCsvButton rows={filtered} columns={CSV_COLUMNS} filename="niche-queries" />
      </div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по запросу"
        className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
      />
      <DataTable
        data={filtered}
        columns={queriesColumns}
        initialSort={[{ id: 'frequency', desc: true }]}
        rowKey={(row) => row.id}
      />
    </div>
  );
}
