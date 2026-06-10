'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/shared/ui/badge';
import { formatRub, formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { SourceRow } from '@/entities/sources';

export const sourcesColumns: ColumnDef<SourceRow, unknown>[] = [
  {
    accessorKey: 'warehouse',
    header: 'Склад',
    cell: ({ row }) => <span className="font-medium">{row.original.warehouse}</span>,
  },
  {
    accessorKey: 'orders',
    header: 'Заказы',
    cell: ({ row }) => <span className="tabular-nums">{formatInt(row.original.orders)}</span>,
  },
  {
    accessorKey: 'units',
    header: 'Продано шт',
    cell: ({ row }) => <span className="tabular-nums">{formatInt(row.original.units)}</span>,
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
    accessorKey: 'share',
    header: 'Доля',
    cell: ({ row }) => {
      const s = row.original.share;
      return (
        <Badge
          variant="outline"
          className={cn(
            'tabular-nums',
            s > 30 ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : '',
            s >= 10 && s <= 30 ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400' : '',
            s < 10 ? 'text-muted-foreground' : '',
          )}
        >
          {s.toFixed(1)}%
        </Badge>
      );
    },
  },
];
