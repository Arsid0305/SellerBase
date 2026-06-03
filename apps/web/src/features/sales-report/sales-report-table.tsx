'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { DataTable } from '@/shared/ui/domain/data-table';
import { SalesSummaryCards } from './sales-summary';
import { salesColumns } from './sales-columns';
import { rowsForGrouping, buildSalesSummary } from './mock-data';
import { cn } from '@/shared/lib/utils';
import type { SalesGrouping } from './types';

const GROUPINGS: { key: SalesGrouping; label: string }[] = [
  { key: 'day', label: 'По дням' },
  { key: 'week', label: 'По неделям' },
  { key: 'month', label: 'По месяцам' },
  { key: 'channel', label: 'По каналам' },
  { key: 'product', label: 'По товарам' },
];

export function SalesReportExplorer() {
  const [grouping, setGrouping] = useState<SalesGrouping>('day');
  const rows = useMemo(() => rowsForGrouping(grouping), [grouping]);
  const summary = useMemo(() => buildSalesSummary(rows), [rows]);

  return (
    <div className="flex flex-col gap-6">
      <SalesSummaryCards summary={summary} />
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
      <DataTable
        data={rows}
        columns={salesColumns}
        initialSort={grouping === 'day' ? [] : [{ id: 'revenue', desc: true }]}
        rowKey={(row) => row.key}
      />
    </div>
  );
}
