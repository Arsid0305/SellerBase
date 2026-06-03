'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { useFiltersStore } from '@/shared/stores/filters';
import type { CsvColumn } from '@/shared/lib/csv';
import { CatalogSummaryCards } from './catalog-summary';
import { catalogColumns } from './catalog-columns';
import { buildCatalogSummary } from './mock-data';
import { cn } from '@/shared/lib/utils';
import type { CatalogProduct, CatalogStatus } from './types';

const STATUS_CHIPS: { key: CatalogStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'in-stock', label: 'В наличии' },
  { key: 'out-of-stock', label: 'Закончились' },
  { key: 'no-sales', label: 'Без продаж 30д' },
  { key: 'excess', label: 'Избыточные' },
];

const CSV_COLUMNS: CsvColumn<CatalogProduct>[] = [
  { key: 'name', label: 'Товар' },
  { key: 'barcode', label: 'Штрихкод' },
  { key: 'channel', label: 'Канал' },
  { key: 'brand', label: 'Бренд' },
  { key: 'category', label: 'Категория' },
  { key: 'sales30dRub', label: 'Продажи 30д ₽' },
  { key: 'sales30dUnits', label: 'Продано шт 30д' },
  { key: 'margin', label: 'Маржа %' },
  { key: 'cost', label: 'Себестоимость' },
  { key: 'price', label: 'Цена' },
  { key: 'stock', label: 'Остаток' },
  { key: 'inTransit', label: 'В пути' },
  { key: 'daysOfStock', label: 'Хватит дней' },
  { key: 'lastSaleDaysAgo', label: 'Посл. продажа дн. назад' },
];

function matchesStatus(row: CatalogProduct, status: CatalogStatus | 'all'): boolean {
  switch (status) {
    case 'all':
      return true;
    case 'in-stock':
      return row.stock > 0;
    case 'out-of-stock':
      return row.stock === 0;
    case 'no-sales':
      return row.sales30dUnits === 0 || row.lastSaleDaysAgo > 14;
    case 'excess':
      return row.daysOfStock > 90;
  }
}

function matchesSearch(row: CatalogProduct, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    row.name.toLowerCase().includes(needle) ||
    row.barcode.toLowerCase().includes(needle) ||
    row.brand.toLowerCase().includes(needle) ||
    row.category.toLowerCase().includes(needle)
  );
}

export function CatalogExplorer({ rows }: { rows: CatalogProduct[] }) {
  const marketplaces = useFiltersStore((s) => s.marketplaces);
  const [status, setStatus] = useState<CatalogStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => marketplaces.includes(r.channel))
        .filter((r) => matchesStatus(r, status))
        .filter((r) => matchesSearch(r, search)),
    [rows, marketplaces, status, search],
  );

  const summary = useMemo(() => buildCatalogSummary(filtered), [filtered]);

  return (
    <div className="flex flex-col gap-6">
      <CatalogSummaryCards summary={summary} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, штрихкоду, бренду, категории…"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_CHIPS.map((c) => {
              const active = status === c.key;
              return (
                <Button
                  key={c.key}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  className={cn(!active && 'text-muted-foreground')}
                  onClick={() => setStatus(c.key)}
                >
                  {c.label}
                </Button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filtered.length} из {rows.length}
            </span>
            <ExportCsvButton rows={filtered} columns={CSV_COLUMNS} filename="catalog" />
          </div>
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={catalogColumns}
        initialSort={[{ id: 'sales30dRub', desc: true }]}
        rowKey={(row) => row.id}
        empty="Ничего не найдено. Попробуйте изменить фильтры."
      />
    </div>
  );
}
