'use client';

import { DataTable } from '@/shared/ui/domain/data-table';
import { deficitColumns } from './columns';
import type { DeficitRow } from './types';

export function DeficitTable({ rows }: { rows: DeficitRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={deficitColumns}
      initialSort={[{ id: 'lostRevenue', desc: true }]}
      rowKey={(row) => row.id}
    />
  );
}
