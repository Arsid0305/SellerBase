'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { SalesSummaryCards } from './sales-summary';
import { salesColumns } from './sales-columns';
import { buildSalesSummary } from './mock-data';
import type { CsvColumn } from '@/shared/lib/csv';
import { cn } from '@/shared/lib/utils';
import type { SalesGrouping, SalesReportRow } from './types';

const GROUPINGS: { key: SalesGrouping; label: string }[] = [
  { key: 'day', label: 'По дням' },
  { key: 'week', label: 'По неделям' },
  { key: 'month', label: 'По месяцам' },
  { key: 'channel', label: 'По каналам' },
  { key: 'product', label: 'По товарам' },
];

const CSV_COLUMNS: CsvColumn<SalesReportRow>[] = [
  { key: 'label', label: 'Период/Категория' },
  { key: 'sublabel', label: 'Код' },
  { key: 'orders', label: 'Заказы' },
  { key: 'unitsSold', label: 'Продано шт' },
  { key: 'revenue', label: 'Выручка ₽' },
  { key: 'avgCheck', label: 'Ср. чек' },
  { key: 'cancellations', label: 'Отмены' },
  { key: 'cancelRate', label: '% отмен' },
];

export function SalesReportExplorer({
  rowsByGrouping,
}: {
  rowsByGrouping?: Record<SalesGrouping, SalesReportRow[]>;
}) {
  const [grouping, setGrouping] = useState<SalesGrouping>('day');
  const rows = useMemo(
    () => (rowsByGrouping ? (rowsByGrouping[grouping] ?? []) : []),
    [grouping, rowsByGrouping],
  );
  const summary = useMemo(() => buildSalesSummary(rows), [rows]);

  return (
    <div className="flex flex-col gap-6">
      <SalesSummaryCards summary={summary} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="shrink-0 pr-2 text-sm text-muted-foreground">Группировка:</span>
          {GROUPINGS.map((g) => {
            const active = g.key === grouping;
            return (
              <Button
                key={g.key}
                variant={active ? 'default' : 'outline'}
                size="sm"
                className={cn('shrink-0', !active && 'text-muted-foreground')}
                onClick={() => setGrouping(g.key)}
              >
                {g.label}
              </Button>
            );
          })}
        </div>
        <ExportCsvButton rows={rows} columns={CSV_COLUMNS} filename={`sales-report-${grouping}`} />
      </div>
      <DataTable
        data={rows}
        columns={salesColumns}
        initialSort={grouping === 'day' ? [] : [{ id: 'revenue', desc: true }]}
        rowKey={(row) => row.key}
        empty="За выбранный период продаж не найдено"
      />
    </div>
  );
}
