'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { useFiltersStore } from '@/shared/stores/filters';
import type { CsvColumn } from '@/shared/lib/csv';
import { turnoverColumns } from './turnover-columns';
import { TurnoverSegments } from './turnover-segments';
import type { TurnoverProduct, TurnoverSegment, TurnoverSegmentKey } from './types';

const CSV_COLUMNS: CsvColumn<TurnoverProduct>[] = [
  { key: 'name', label: 'Товар' },
  { key: 'barcode', label: 'Штрихкод' },
  { key: 'myArticle', label: 'Мой артикул' },
  { key: 'wbArticle', label: 'WB артикул' },
  { key: 'channel', label: 'Канал' },
  { key: 'segment', label: 'Сегмент' },
  { key: 'stockUnits', label: 'Остаток шт' },
  { key: 'dailySales', label: 'Продажи/день' },
  { key: 'daysOfStock', label: 'Хватит дней' },
  { key: 'revenue', label: 'Выручка' },
];

function rowTone(p: TurnoverProduct): string | undefined {
  if (p.dailySales > 0 && p.daysOfStock < 7) return 'bg-rose-500/5 hover:bg-rose-500/10';
  if (p.daysOfStock > 90) return 'bg-amber-500/5 hover:bg-amber-500/10';
  return undefined;
}

export function TurnoverExplorer({
  segments,
  products,
}: {
  segments: TurnoverSegment[];
  products: TurnoverProduct[];
}) {
  const [active, setActive] = useState<TurnoverSegmentKey>('all');
  const [search, setSearch] = useState('');
  const marketplaces = useFiltersStore((s) => s.marketplaces);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!marketplaces.includes(p.channel)) return false;
      if (active !== 'all' && p.segment !== active) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.myArticle ?? '').toLowerCase().includes(q) ||
        (p.wbArticle != null && String(p.wbArticle).includes(q)) ||
        p.barcode.toLowerCase().includes(q)
      );
    });
  }, [active, marketplaces, products, search]);

  return (
    <div className="flex flex-col gap-6">
      <TurnoverSegments segments={segments} active={active} onSelect={setActive} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию, штрихкоду, my_article, wb_article…"
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Показано {filtered.length} товаров</span>
          <ExportCsvButton rows={filtered} columns={CSV_COLUMNS} filename="turnover" />
        </div>
      </div>
      <DataTable
        data={filtered}
        columns={turnoverColumns}
        initialSort={[{ id: 'daysOfStock', desc: false }]}
        rowKey={(row) => row.id}
        rowClassName={rowTone}
        empty="В этом сегменте пока нет товаров"
      />
    </div>
  );
}
