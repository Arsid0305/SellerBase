'use client';

import { DataTable } from '@/shared/ui/domain/data-table';
import { analyticsColumns } from './analytics-columns';
import type { AnalyticsRow } from './types';

export function AnalyticsTable({ rows }: { rows: AnalyticsRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={analyticsColumns}
      initialSort={[{ id: 'revenue', desc: true }]}
      rowKey={(row) => row.id}
    />
  );
}
