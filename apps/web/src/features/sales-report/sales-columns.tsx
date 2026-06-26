'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { formatRub, formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { SalesReportRow } from './types';

export const salesColumns: ColumnDef<SalesReportRow, unknown>[] = [
  {
    accessorKey: 'label',
    header: 'Период / Категория',
    cell: ({ row }) => (
      <div className="flex min-w-[200px] flex-col gap-0.5">
        <span className="font-medium leading-tight">{row.original.label}</span>
        {row.original.sublabel && (
          <span className="text-[11px] text-muted-foreground">{row.original.sublabel}</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'orders',
    header: 'Заказы',
    cell: ({ row }) => <span className="tabular-nums font-medium">{formatInt(row.original.orders)}</span>,
  },
  {
    accessorKey: 'unitsSold',
    header: 'Продано шт.',
    cell: ({ row }) => <span className="tabular-nums">{formatInt(row.original.unitsSold)}</span>,
  },
  {
    accessorKey: 'revenue',
    header: 'Выручка',
    cell: ({ row }) => <span className="tabular-nums font-medium">{formatRub(row.original.revenue)}</span>,
  },
  {
    accessorKey: 'avgCheck',
    header: 'Средний чек',
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatRub(row.original.avgCheck)}</span>,
  },
  {
    accessorKey: 'cancellations',
    header: 'Возвраты',
    cell: ({ row }) => (
      <span className={cn('tabular-nums', row.original.cancellations > 0 && 'text-rose-600 dark:text-rose-400')}>
        {formatInt(row.original.cancellations)}
      </span>
    ),
  },
  {
    accessorKey: 'cancelRate',
    header: '% возвратов',
    cell: ({ row }) => {
      const v = row.original.cancelRate;
      return (
        <span
          className={cn(
            'tabular-nums',
            v > 8
              ? 'text-rose-600 dark:text-rose-400 font-medium'
              : v > 5
                ? 'text-amber-600 dark:text-amber-400 font-medium'
                : 'text-muted-foreground',
          )}
        >
          {v.toFixed(1)}%
        </span>
      );
    },
  },
];
