'use client';

import { useMemo } from 'react';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { useFiltersStore } from '@/shared/stores/filters';
import type { CsvColumn } from '@/shared/lib/csv';
import { deficitColumns } from './columns';
import type { DeficitRow } from './types';

const CSV_COLUMNS: CsvColumn<DeficitRow>[] = [
  { key: 'name', label: 'Название' },
  { key: 'barcode', label: 'Штрихкод' },
  { key: 'channel', label: 'Канал' },
  { key: 'warehouse', label: 'Склад' },
  { key: 'lostRevenue', label: 'Упущено ₽' },
  { key: 'forecastDemand', label: 'Прогноз ₽' },
  { key: 'daysLeft', label: 'Хватит дней' },
  { key: 'toSupply', label: 'К поставке шт' },
  { key: 'dailySales', label: 'Продажи/день' },
  { key: 'stock', label: 'Остаток шт' },
];

export function DeficitTable({ rows }: { rows: DeficitRow[] }) {
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
        <ExportCsvButton rows={filtered} columns={CSV_COLUMNS} filename="deficit" />
      </div>
      <DataTable
        data={filtered}
        columns={deficitColumns}
        initialSort={[{ id: 'lostRevenue', desc: true }]}
        rowKey={(row) => row.id}
      />
    </div>
  );
}
