'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import type { CsvColumn } from '@/shared/lib/csv';
import { productsColumns } from './products-columns';
import type { PromotedProduct } from './types';

const CSV_COLUMNS: CsvColumn<PromotedProduct>[] = [
  { key: 'name', label: 'Товар' },
  { key: 'barcode', label: 'Штрихкод' },
  { key: 'channel', label: 'Канал' },
  { key: 'impressions', label: 'Показы' },
  { key: 'clicks', label: 'Клики' },
  { key: 'orders', label: 'Заказы' },
  { key: 'ctr', label: 'CTR %' },
  { key: 'cr', label: 'CR %' },
  { key: 'spend', label: 'Расход ₽' },
  { key: 'revenue', label: 'Выручка ₽' },
  { key: 'roas', label: 'ROAS ×' },
];

export function PromotedProductsTable({ products }: { products: PromotedProduct[] }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => products.filter((p) => (search ? p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search) : true)),
    [products, search],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Товары в рекламе</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">
            {filtered.length} из {products.length}
          </span>
          <ExportCsvButton rows={filtered} columns={CSV_COLUMNS} filename="ad-products" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию или штрихкоду…"
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <DataTable
          data={filtered}
          columns={productsColumns}
          initialSort={[{ id: 'revenue', desc: true }]}
          rowKey={(row) => row.id}
          empty="Товары не найдены."
        />
      </CardContent>
    </Card>
  );
}
