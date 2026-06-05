'use client';

import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import type { CsvColumn } from '@/shared/lib/csv';
import { sourcesColumns } from './sources-columns';
import type { SourceRow } from '@/entities/sources';

const CSV_COLUMNS: CsvColumn<SourceRow>[] = [
  { key: 'warehouse', label: 'Склад' },
  { key: 'orders', label: 'Заказы' },
  { key: 'units', label: 'Продано шт' },
  { key: 'revenue', label: 'Выручка ₽' },
  { key: 'avgCheck', label: 'Ср. чек' },
  { key: 'share', label: 'Доля %' },
];

export function SourcesTable({ rows }: { rows: SourceRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <ExportCsvButton rows={rows} columns={CSV_COLUMNS} filename="sources-by-warehouse" />
      </div>
      <DataTable
        data={rows}
        columns={sourcesColumns}
        initialSort={[{ id: 'revenue', desc: true }]}
        rowKey={(row) => row.warehouse}
        empty="Нет данных по источникам заказов за период"
      />
    </div>
  );
}
