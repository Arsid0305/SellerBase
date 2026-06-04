'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Sparkline } from '@/shared/ui/domain/sparkline';
import { formatRub, formatInt, formatCompact } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { NicheCategory } from './types';

function competitivenessClass(v: number): string {
  if (v < 4) return 'text-emerald-600 dark:text-emerald-400';
  if (v <= 7) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function competitivenessLabel(v: number): string {
  if (v < 4) return 'легко войти';
  if (v <= 7) return 'средняя';
  return 'высокая';
}

export const categoriesColumns: ColumnDef<NicheCategory, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Категория',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'sellersCount',
    header: 'Продавцов',
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{formatInt(row.original.sellersCount)}</span>
    ),
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
    accessorKey: 'avgPrice',
    header: 'Средний чек',
    cell: ({ row }) => <span className="tabular-nums">{formatRub(row.original.avgPrice)}</span>,
  },
  {
    accessorKey: 'topBrandShare',
    header: 'Доля топ-бренда',
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{row.original.topBrandShare.toFixed(1)}%</span>
    ),
  },
  {
    accessorKey: 'competitiveness',
    header: 'Конкуренция',
    cell: ({ row }) => {
      const v = row.original.competitiveness;
      return (
        <span className={cn('inline-flex items-center gap-1.5 tabular-nums font-medium', competitivenessClass(v))}>
          {v.toFixed(1)}
          <span className="text-xs font-normal opacity-80">· {competitivenessLabel(v)}</span>
        </span>
      );
    },
  },
  {
    id: 'trend30d',
    header: 'Тренд (30 дн)',
    cell: ({ row }) => {
      const d = row.original.trend30d;
      const trend = d[d.length - 1] > d[0] ? 'up' : d[d.length - 1] < d[0] ? 'down' : 'flat';
      return <Sparkline data={d} trend={trend} width={84} height={24} />;
    },
    enableSorting: false,
  },
];
