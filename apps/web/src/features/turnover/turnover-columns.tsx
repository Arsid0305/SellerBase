'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { ProductTagBadge } from '@/shared/ui/domain/product-tag-badge';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { Badge } from '@/shared/ui/badge';
import { formatRub, formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { TurnoverProduct } from './types';

function daysOfStockTone(value: number): string {
  if (value === 0) return 'text-rose-600 dark:text-rose-400 font-semibold';
  if (value < 7) return 'text-amber-600 dark:text-amber-400 font-medium';
  if (value > 90) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400 font-medium';
}

export const turnoverColumns: ColumnDef<TurnoverProduct, unknown>[] = [
  {
    id: 'photo',
    header: '',
    cell: ({ row }) => (
      <SkuThumb src={row.original.photoUrl} alt={row.original.name} size="sm" />
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'name',
    header: 'Товар',
    cell: ({ row }) => (
      <Link
        href={`/products/${encodeURIComponent(row.original.barcode)}`}
        className="flex min-w-[240px] flex-col gap-0.5 hover:underline"
      >
        <span className="font-medium leading-tight">{row.original.name}</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {row.original.barcode}
          {row.original.myArticle ? ` · ${row.original.myArticle}` : ''}
          {row.original.wbArticle != null ? ` · WB ${row.original.wbArticle}` : ''}
        </span>
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
    accessorKey: 'stockUnits',
    header: 'Остаток',
    cell: ({ row }) => (
      <span
        className={cn(
          'tabular-nums',
          row.original.stockUnits === 0 ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-foreground',
        )}
      >
        {formatInt(row.original.stockUnits)} шт.
      </span>
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
    accessorKey: 'daysOfStock',
    header: 'Хватит на',
    cell: ({ row }) => (
      <span className={cn('tabular-nums', daysOfStockTone(row.original.daysOfStock))}>
        {row.original.daysOfStock} д.
      </span>
    ),
  },
  {
    accessorKey: 'revenue',
    header: 'Выручка',
    cell: ({ row }) => <span className="tabular-nums font-medium">{formatRub(row.original.revenue)}</span>,
  },
];
