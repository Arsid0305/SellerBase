'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { Badge } from '@/shared/ui/badge';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { CsvColumn } from '@/shared/lib/csv';
import { MarketplaceBadge, daysSince } from './marketplace-badge';
import { mockCommissions } from './mock-data';
import type { CommissionTariff } from './types';

function commissionTone(value: number): string {
  if (value < 15) return 'text-emerald-600 dark:text-emerald-400 font-medium';
  if (value < 22) return 'text-amber-600 dark:text-amber-400 font-medium';
  return 'text-rose-600 dark:text-rose-400 font-semibold';
}

const columns: ColumnDef<CommissionTariff, unknown>[] = [
  {
    accessorKey: 'marketplace',
    header: 'Канал',
    cell: ({ row }) => <MarketplaceBadge marketplace={row.original.marketplace} />,
  },
  {
    accessorKey: 'category',
    header: 'Категория',
    cell: ({ row }) => <span className="font-medium">{row.original.category}</span>,
  },
  {
    accessorKey: 'fboCommission',
    header: 'Комиссия FBO',
    cell: ({ row }) => (
      <span className={cn('tabular-nums', commissionTone(row.original.fboCommission))}>
        {row.original.fboCommission}%
      </span>
    ),
  },
  {
    accessorKey: 'fbsCommission',
    header: 'Комиссия FBS',
    cell: ({ row }) => (
      <span className={cn('tabular-nums', commissionTone(row.original.fbsCommission))}>
        {row.original.fbsCommission}%
      </span>
    ),
  },
  {
    accessorKey: 'updatedAt',
    header: 'Обновлено',
    cell: ({ row }) => {
      const days = daysSince(row.original.updatedAt);
      return (
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-muted-foreground">{formatDate(row.original.updatedAt)}</span>
          {days < 30 && (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400"
            >
              Обновлено
            </Badge>
          )}
        </div>
      );
    },
  },
];

const CSV_COLUMNS: CsvColumn<CommissionTariff>[] = [
  { key: 'marketplace', label: 'Канал' },
  { key: 'category', label: 'Категория' },
  { key: 'fboCommission', label: 'FBO %' },
  { key: 'fbsCommission', label: 'FBS %' },
  { key: 'updatedAt', label: 'Обновлено' },
];

export function CommissionTable() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Комиссии по категориям WB/Ozon</span>
        <ExportCsvButton rows={mockCommissions} columns={CSV_COLUMNS} filename="tariffs-commissions" />
      </div>
      <DataTable
        data={mockCommissions}
        columns={columns}
        initialSort={[{ id: 'category', desc: false }]}
        rowKey={(row) => row.id}
        empty="Нет тарифов"
      />
    </div>
  );
}
