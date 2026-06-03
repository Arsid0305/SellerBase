'use client';

import { useMemo, useState } from 'react';
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
  { key: 'channel', label: 'Канал' },
  { key: 'segment', label: 'Сегмент' },
  { key: 'stockUnits', label: 'Остаток шт' },
  { key: 'dailySales', label: 'Продажи/день' },
  { key: 'daysOfStock', label: 'Хватит дней' },
  { key: 'revenue', label: 'Выручка' },
];

export function TurnoverExplorer({
  segments,
  products,
}: {
  segments: TurnoverSegment[];
  products: TurnoverProduct[];
}) {
  const [active, setActive] = useState<TurnoverSegmentKey>('all');
  const marketplaces = useFiltersStore((s) => s.marketplaces);
  const filtered = useMemo(() => {
    const byChannel = products.filter((p) => marketplaces.includes(p.channel));
    return active === 'all' ? byChannel : byChannel.filter((p) => p.segment === active);
  }, [active, marketplaces, products]);

  return (
    <div className="flex flex-col gap-6">
      <TurnoverSegments segments={segments} active={active} onSelect={setActive} />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Показано {filtered.length} товаров
        </span>
        <ExportCsvButton rows={filtered} columns={CSV_COLUMNS} filename="turnover" />
      </div>
      <DataTable
        data={filtered}
        columns={turnoverColumns}
        initialSort={[{ id: 'daysOfStock', desc: false }]}
        rowKey={(row) => row.id}
        empty="В этом сегменте пока нет товаров"
      />
    </div>
  );
}
