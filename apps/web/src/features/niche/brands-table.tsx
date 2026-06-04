'use client';

import { useMemo, useState } from 'react';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import type { CsvColumn } from '@/shared/lib/csv';
import { brandsColumns } from './brands-columns';
import type { NicheBrand } from './types';

const CSV_COLUMNS: CsvColumn<NicheBrand>[] = [
  { key: 'name', label: 'Бренд' },
  { key: 'productsCount', label: 'Товаров' },
  { key: 'monthlyRevenue', label: 'Выручка/мес ₽' },
  { key: 'avgRating', label: 'Рейтинг' },
  { key: 'topCategory', label: 'Топ-категория' },
  { key: 'marketShare', label: 'Доля рынка %' },
];

export function BrandsTable({ brands }: { brands: NicheBrand[] }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter(
      (b) => b.name.toLowerCase().includes(q) || b.topCategory.toLowerCase().includes(q),
    );
  }, [brands, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Топ брендов</h2>
        <ExportCsvButton rows={filtered} columns={CSV_COLUMNS} filename="niche-brands" />
      </div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по бренду или категории"
        className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
      />
      <DataTable
        data={filtered}
        columns={brandsColumns}
        initialSort={[{ id: 'monthlyRevenue', desc: true }]}
        rowKey={(row) => row.id}
      />
    </div>
  );
}
