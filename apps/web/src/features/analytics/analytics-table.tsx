'use client';

import { useMemo } from 'react';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { useFiltersStore } from '@/shared/stores/filters';
import type { CsvColumn } from '@/shared/lib/csv';
import { analyticsColumns } from './analytics-columns';
import type { AnalyticsRow } from './types';

const CSV_COLUMNS: CsvColumn<AnalyticsRow>[] = [
  { key: 'name', label: 'Товар' },
  { key: 'barcode', label: 'Штрихкод' },
  { key: 'channel', label: 'Канал' },
  { key: 'profit', label: 'ABC прибыль' },
  { key: 'sales', label: 'ABC продаж' },
  { key: 'stability', label: 'XYZ' },
  { key: 'revenue', label: 'Выручка' },
  { key: 'margin', label: 'Маржа %' },
  { key: 'cost', label: 'Себестоимость' },
  { key: 'unitsSold', label: 'Продано шт' },
  { key: 'stock', label: 'Остаток шт' },
];

export function AnalyticsTable({ rows }: { rows: AnalyticsRow[] }) {
  const marketplaces = useFiltersStore((s) => s.marketplaces);
  const filtered = useMemo(
    () => rows.filter((r) => marketplaces.includes(r.channel)),
    [rows, marketplaces],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Показано {filtered.length} из {rows.length} товаров
        </span>
        <ExportCsvButton rows={filtered} columns={CSV_COLUMNS} filename="analytics" />
      </div>
      <DataTable
        data={filtered}
        columns={analyticsColumns}
        initialSort={[{ id: 'revenue', desc: true }]}
        rowKey={(row) => row.id}
      />
    </div>
  );
}
