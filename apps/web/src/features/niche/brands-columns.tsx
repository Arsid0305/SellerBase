'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Star } from 'lucide-react';
import { formatInt, formatCompact } from '@/shared/lib/format';
import type { NicheBrand } from './types';

export const brandsColumns: ColumnDef<NicheBrand, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Бренд',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'productsCount',
    header: 'Товаров',
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{formatInt(row.original.productsCount)}</span>
    ),
  },
  {
    accessorKey: 'monthlyRevenue',
    header: 'Выручка / мес',
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{formatCompact(row.original.monthlyRevenue)} ₽</span>
    ),
  },
  {
    accessorKey: 'avgRating',
    header: 'Рейтинг',
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 tabular-nums">
        <Star className="size-3.5 fill-amber-500 text-amber-500" />
        {row.original.avgRating.toFixed(1)}
      </span>
    ),
  },
  {
    accessorKey: 'topCategory',
    header: 'Топ-категория',
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.topCategory}</span>,
  },
  {
    accessorKey: 'marketShare',
    header: 'Доля рынка',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.marketShare.toFixed(1)}%</span>
    ),
  },
];
