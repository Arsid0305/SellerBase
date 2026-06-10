'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/shared/ui/badge';
import { formatRub, formatInt, formatCompact } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { PromotedProduct } from './types';

export const productsColumns: ColumnDef<PromotedProduct, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Товар',
    cell: ({ row }) => (
      <Link
        href={`/products/${encodeURIComponent(row.original.barcode)}`}
        className="flex min-w-[240px] flex-col gap-0.5 hover:underline"
      >
        <span className="font-medium leading-tight">{row.original.name}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{row.original.barcode}</span>
      </Link>
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
    accessorKey: 'impressions',
    header: 'Показы',
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatCompact(row.original.impressions)}</span>,
  },
  {
    accessorKey: 'clicks',
    header: 'Клики',
    cell: ({ row }) => <span className="tabular-nums">{formatInt(row.original.clicks)}</span>,
  },
  {
    accessorKey: 'orders',
    header: 'Заказы',
    cell: ({ row }) => <span className="tabular-nums">{formatInt(row.original.orders)}</span>,
  },
  {
    accessorKey: 'ctr',
    header: 'CTR',
    cell: ({ row }) => <span className="tabular-nums">{row.original.ctr.toFixed(2)}%</span>,
  },
  {
    accessorKey: 'cr',
    header: 'CR',
    cell: ({ row }) => {
      const v = row.original.cr;
      const tone = v < 2 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400';
      return <span className={cn('tabular-nums font-medium', tone)}>{v.toFixed(2)}%</span>;
    },
  },
  {
    accessorKey: 'spend',
    header: 'Расход',
    cell: ({ row }) => <span className="tabular-nums">{formatRub(row.original.spend)}</span>,
  },
  {
    accessorKey: 'revenue',
    header: 'Выручка',
    cell: ({ row }) => <span className="tabular-nums">{formatRub(row.original.revenue)}</span>,
  },
  {
    accessorKey: 'roas',
    header: 'ROAS',
    cell: ({ row }) => {
      const v = row.original.roas;
      const tone =
        v < 2
          ? 'text-rose-600 dark:text-rose-400'
          : v <= 4
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-emerald-600 dark:text-emerald-400';
      return <span className={cn('tabular-nums font-medium', tone)}>{v.toFixed(2)}×</span>;
    },
  },
];
