'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { ProductTagBadge } from '@/shared/ui/domain/product-tag-badge';
import { Badge } from '@/shared/ui/badge';
import { formatRub, formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { DeficitRow } from './types';

function daysLeftClass(value: number): string {
  if (value === 0) return 'text-rose-600 dark:text-rose-400 font-semibold';
  if (value < 3) return 'text-rose-600 dark:text-rose-400 font-medium';
  if (value <= 7) return 'text-amber-600 dark:text-amber-400 font-medium';
  return 'text-muted-foreground';
}

function daysLeftLabel(value: number): string {
  if (value === 0) return 'Хватит на 0 д.';
  if (value === 1) return 'Хватит на 1 д.';
  if (value < 5) return `Хватит на ${value} д.`;
  return `Хватит на ${value} дн.`;
}

export const deficitColumns: ColumnDef<DeficitRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Название',
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
    accessorKey: 'warehouse',
    header: 'Склад',
    cell: ({ row }) => <span className="text-sm">{row.original.warehouse}</span>,
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
    accessorKey: 'lostRevenue',
    header: 'Упущено ₽',
    cell: ({ row }) => (
      <span className={cn('tabular-nums', row.original.lostRevenue > 0 && 'font-medium text-rose-600 dark:text-rose-400')}>
        {formatRub(row.original.lostRevenue)}
      </span>
    ),
  },
  {
    accessorKey: 'forecastDemand',
    header: 'Прогноз ₽',
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{formatRub(row.original.forecastDemand)}</span>
    ),
  },
  {
    accessorKey: 'daysLeft',
    header: 'Остаток дней',
    cell: ({ row }) => (
      <span className={cn('tabular-nums', daysLeftClass(row.original.daysLeft))}>
        {daysLeftLabel(row.original.daysLeft)}
      </span>
    ),
  },
  {
    accessorKey: 'toSupply',
    header: 'К поставке',
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{formatInt(row.original.toSupply)} шт.</span>
    ),
  },
  {
    accessorKey: 'dailySales',
    header: 'Продажи/день',
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{row.original.dailySales.toFixed(2)} шт.</span>
    ),
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
