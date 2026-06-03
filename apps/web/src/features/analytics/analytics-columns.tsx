'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { ProductTagBadge } from '@/shared/ui/domain/product-tag-badge';
import { Badge } from '@/shared/ui/badge';
import { formatRub, formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { AnalyticsRow } from './types';

export const analyticsColumns: ColumnDef<AnalyticsRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Товар',
    cell: ({ row }) => (
      <div className="flex min-w-[240px] flex-col gap-0.5">
        <span className="font-medium leading-tight">{row.original.name}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{row.original.barcode}</span>
      </div>
    ),
  },
  {
    accessorKey: 'channel',
    header: 'Канал',
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={cn(
          'font-mono text-[10px]',
          row.original.channel === 'WB' && 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400',
          row.original.channel === 'OZON' && 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
        )}
      >
        {row.original.channel}
      </Badge>
    ),
  },
  {
    id: 'tags',
    header: 'Метки',
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1">
        {row.original.tags.map((tag) => (
          <ProductTagBadge key={tag} kind={tag} />
        ))}
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'revenue',
    header: 'Выручка',
    cell: ({ row }) => <span className="tabular-nums font-medium">{formatRub(row.original.revenue)}</span>,
  },
  {
    accessorKey: 'margin',
    header: 'Маржа',
    cell: ({ row }) => {
      const m = row.original.margin;
      return (
        <span
          className={cn(
            'tabular-nums font-medium',
            m < 0
              ? 'text-rose-600 dark:text-rose-400'
              : m < 15
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400',
          )}
        >
          {m.toFixed(1)}%
        </span>
      );
    },
  },
  {
    accessorKey: 'cost',
    header: 'Себест.',
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatRub(row.original.cost)}</span>,
  },
  {
    accessorKey: 'unitsSold',
    header: 'Продано',
    cell: ({ row }) => <span className="tabular-nums">{formatInt(row.original.unitsSold)} шт.</span>,
  },
  {
    accessorKey: 'stock',
    header: 'Остаток',
    cell: ({ row }) => (
      <span
        className={cn(
          'tabular-nums',
          row.original.stock === 0 ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-foreground',
        )}
      >
        {formatInt(row.original.stock)} шт.
      </span>
    ),
  },
];
