'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { formatDate } from '@/shared/lib/format';
import type { CsvColumn } from '@/shared/lib/csv';
import { MarketplaceBadge } from './marketplace-badge';
import { mockStorage } from './mock-data';
import type { StorageTariff } from './types';

const columns: ColumnDef<StorageTariff, unknown>[] = [
  {
    accessorKey: 'marketplace',
    header: 'Канал',
    cell: ({ row }) => <MarketplaceBadge marketplace={row.original.marketplace} />,
  },
  {
    accessorKey: 'warehouse',
    header: 'Склад',
    cell: ({ row }) => <span className="font-medium">{row.original.warehouse}</span>,
  },
  {
    accessorKey: 'perLiterDay',
    header: '₽ / литр / день',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.perLiterDay.toFixed(2)} ₽</span>
    ),
  },
  {
    accessorKey: 'perUnitDay',
    header: '₽ / единица / день',
    cell: ({ row }) =>
      row.original.perUnitDay != null ? (
        <span className="tabular-nums">{row.original.perUnitDay.toFixed(2)} ₽</span>
      ) : (
        <span className="text-muted-foreground">—</span>
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

const CSV_COLUMNS: CsvColumn<StorageTariff>[] = [
  { key: 'marketplace', label: 'Канал' },
  { key: 'warehouse', label: 'Склад' },
  { key: 'perLiterDay', label: '₽/л/день' },
  { key: 'perUnitDay', label: '₽/ед/день' },
  { key: 'updatedAt', label: 'Обновлено' },
];

export function StorageTable() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Стоимость хранения на складах</span>
        <ExportCsvButton rows={mockStorage} columns={CSV_COLUMNS} filename="tariffs-storage" />
      </div>
      <DataTable
        data={mockStorage}
        columns={columns}
        initialSort={[{ id: 'warehouse', desc: false }]}
        rowKey={(row) => row.id}
        empty="Нет тарифов"
      />
    </div>
  );
}
