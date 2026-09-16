'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { formatDate } from '@/shared/lib/format';
import type { CsvColumn } from '@/shared/lib/csv';
import type { WbTariffsReturn } from '@/entities/wb-tariffs';

const columns: ColumnDef<WbTariffsReturn, unknown>[] = [
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
    accessorKey: 'returnBase',
    header: 'База возврата, ₽',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.returnBase.toFixed(2)}</span>
    ),
  },
  {
    accessorKey: 'returnLiter',
    header: 'Доп. литр, ₽',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.returnLiter.toFixed(2)}</span>
    ),
  },
];

const CSV_COLUMNS: CsvColumn<WbTariffsReturn>[] = [
  { key: 'warehouseName', label: 'Склад' },
  { key: 'geoName', label: 'Регион' },
  { key: 'returnBase', label: 'База ₽' },
  { key: 'returnLiter', label: 'Доп литр ₽' },
];

export function WbReturnTariffsTable({ rows }: { rows: WbTariffsReturn[] }) {
  const date = rows[0]?.effectiveDate;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Тарифы возврата · {date ? `на ${formatDate(date)}` : 'нет данных'}
        </span>
        <ExportCsvButton rows={rows} columns={CSV_COLUMNS} filename="wb-tariffs-return" />
      </div>
      <DataTable
        data={rows}
        columns={columns}
        initialSort={[{ id: 'warehouseName', desc: false }]}
        rowKey={(row) => String(row.id)}
        empty="Тарифы возврата ещё не загружены."
      />
    </div>
  );
}
