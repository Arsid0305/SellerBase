'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { formatRub, formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { CsvColumn } from '@/shared/lib/csv';
import { MarketplaceBadge } from './marketplace-badge';
import { mockDimensions } from './mock-data';
import type { DimensionTariff } from './types';

function surchargeTone(value: number): string {
  if (value === 0) return 'text-muted-foreground';
  if (value <= 100) return 'text-amber-600 dark:text-amber-400 font-medium';
  return 'text-rose-600 dark:text-rose-400 font-semibold';
}

const columns: ColumnDef<DimensionTariff, unknown>[] = [
  {
    accessorKey: 'marketplace',
    header: 'Канал',
    cell: ({ row }) => <MarketplaceBadge marketplace={row.original.marketplace} />,
  },
  {
    accessorKey: 'category',
    header: 'Категория',
    cell: ({ row }) => <span className="font-medium">{row.original.category}</span>,
  },
  {
    id: 'volume',
    header: 'Объём',
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.volumeMin}–{row.original.volumeMax} л
      </span>
    ),
    accessorFn: (row) => row.volumeMin,
  },
  {
    accessorKey: 'surcharge',
    header: 'Надбавка',
    cell: ({ row }) => (
      <span className={cn('tabular-nums', surchargeTone(row.original.surcharge))}>
        {formatRub(row.original.surcharge)}
      </span>
    ),
  },
  {
    accessorKey: 'updatedAt',
    header: 'Обновлено',
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{formatDate(row.original.updatedAt)}</span>
    ),
  },
];

const CSV_COLUMNS: CsvColumn<DimensionTariff>[] = [
  { key: 'marketplace', label: 'Канал' },
  { key: 'category', label: 'Категория' },
  { key: 'volumeMin', label: 'Объём от, л' },
  { key: 'volumeMax', label: 'Объём до, л' },
  { key: 'surcharge', label: 'Надбавка ₽' },
  { key: 'updatedAt', label: 'Обновлено' },
];

export function DimensionTable() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Надбавки за объёмный вес</span>
        <ExportCsvButton rows={mockDimensions} columns={CSV_COLUMNS} filename="tariffs-dimensions" />
      </div>
      <DataTable
        data={mockDimensions}
        columns={columns}
        initialSort={[{ id: 'volume', desc: false }]}
        rowKey={(row) => row.id}
        empty="Нет тарифов"
      />
    </div>
  );
}
