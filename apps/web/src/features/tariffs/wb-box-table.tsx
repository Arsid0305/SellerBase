'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { formatDate } from '@/shared/lib/format';
import type { CsvColumn } from '@/shared/lib/csv';
import type { WbTariffsBox } from '@/entities/wb-tariffs';

const columns: ColumnDef<WbTariffsBox, unknown>[] = [
  {
    accessorKey: 'warehouseName',
    header: 'Склад',
    cell: ({ row }) => <span className="font-medium">{row.original.warehouseName}</span>,
  },
  {
    accessorKey: 'geoName',
    header: 'Регион',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.geoName}</span>,
  },
  {
    accessorKey: 'warehouseCoef',
    header: 'Коэф. склада',
    cell: ({ row }) => (
      <span className="tabular-nums font-medium">{row.original.warehouseCoef.toFixed(2)}</span>
    ),
  },
  {
    accessorKey: 'boxDeliveryBase',
    header: 'База, ₽ (1-й литр)',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.boxDeliveryBase.toFixed(2)}</span>
    ),
  },
  {
    accessorKey: 'boxDeliveryLiter',
    header: 'Доп. литр, ₽',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.boxDeliveryLiter.toFixed(2)}</span>
    ),
  },
  {
    accessorKey: 'boxStorageBase',
    header: 'Хранение база, ₽',
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.boxStorageBase.toFixed(2)}
      </span>
    ),
  },
  {
    accessorKey: 'boxStorageLiter',
    header: 'Хранение литр, ₽',
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.boxStorageLiter.toFixed(2)}
      </span>
    ),
  },
];

const CSV_COLUMNS: CsvColumn<WbTariffsBox>[] = [
  { key: 'warehouseName', label: 'Склад' },
  { key: 'geoName', label: 'Регион' },
  { key: 'warehouseCoef', label: 'Коэф склада' },
  { key: 'boxDeliveryBase', label: 'Доставка база ₽' },
  { key: 'boxDeliveryLiter', label: 'Доставка литр ₽' },
  { key: 'boxStorageBase', label: 'Хранение база ₽' },
  { key: 'boxStorageLiter', label: 'Хранение литр ₽' },
];

export function WbBoxTariffsTable({ rows }: { rows: WbTariffsBox[] }) {
  const date = rows[0]?.effectiveDate;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Базовые тарифы FBO по складам · {date ? `на ${formatDate(date)}` : 'нет данных'}
        </span>
        <ExportCsvButton rows={rows} columns={CSV_COLUMNS} filename="wb-tariffs-box" />
      </div>
      <DataTable
        data={rows}
        columns={columns}
        initialSort={[{ id: 'warehouseCoef', desc: false }]}
        rowKey={(row) => String(row.id)}
        empty="Тарифы ещё не загружены. Дождитесь первого запуска fetch-wb-tariffs."
      />
    </div>
  );
}
