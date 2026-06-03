'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { formatRub, formatDate } from '@/shared/lib/format';
import type { CsvColumn } from '@/shared/lib/csv';
import { MarketplaceBadge } from './marketplace-badge';
import { mockLogistics } from './mock-data';
import type { LogisticsTariff } from './types';

const columns: ColumnDef<LogisticsTariff, unknown>[] = [
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
    accessorKey: 'region',
    header: 'Регион',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.region}</span>,
  },
  {
    accessorKey: 'sortingCost',
    header: 'Сортировка',
    cell: ({ row }) => <span className="tabular-nums">{formatRub(row.original.sortingCost)}</span>,
  },
  {
    accessorKey: 'deliveryCost',
    header: 'Доставка',
    cell: ({ row }) => <span className="tabular-nums font-medium">{formatRub(row.original.deliveryCost)}</span>,
  },
  {
    accessorKey: 'updatedAt',
    header: 'Обновлено',
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{formatDate(row.original.updatedAt)}</span>
    ),
  },
];

const CSV_COLUMNS: CsvColumn<LogisticsTariff>[] = [
  { key: 'marketplace', label: 'Канал' },
  { key: 'warehouse', label: 'Склад' },
  { key: 'region', label: 'Регион' },
  { key: 'sortingCost', label: 'Сортировка ₽' },
  { key: 'deliveryCost', label: 'Доставка ₽' },
  { key: 'updatedAt', label: 'Обновлено' },
];

export function LogisticsTable() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Тарифы логистики по складам/регионам</span>
        <ExportCsvButton rows={mockLogistics} columns={CSV_COLUMNS} filename="tariffs-logistics" />
      </div>
      <DataTable
        data={mockLogistics}
        columns={columns}
        initialSort={[{ id: 'warehouse', desc: false }]}
        rowKey={(row) => row.id}
        empty="Нет тарифов"
      />
    </div>
  );
}
