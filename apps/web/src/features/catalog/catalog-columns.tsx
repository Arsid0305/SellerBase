'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { ProductTagBadge } from '@/shared/ui/domain/product-tag-badge';
import { LifecycleBadge } from '@/shared/ui/domain/lifecycle-badge';
import { Sparkline } from '@/shared/ui/domain/sparkline';
import { Badge } from '@/shared/ui/badge';
import { formatRub, formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { CatalogProduct } from './types';

export const catalogColumns: ColumnDef<CatalogProduct, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Товар',
    cell: ({ row }) => (
      <Link
        href={`/products/${encodeURIComponent(row.original.barcode)}`}
        className="flex min-w-[260px] flex-col gap-0.5 hover:underline"
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
    accessorKey: 'brand',
    header: 'Бренд',
    cell: ({ row }) => <span className="text-sm">{row.original.brand}</span>,
  },
  {
    accessorKey: 'category',
    header: 'Категория',
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.category}</span>,
  },
  {
    id: 'lifecycle',
    header: 'Состояние',
    cell: ({ row }) => <LifecycleBadge state={row.original.lifecycle ?? 'STABLE'} showDescription />,
    enableSorting: false,
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
    accessorKey: 'sales30dRub',
    header: 'Продажи 30д',
    cell: ({ row }) => (
      <div className="flex flex-col items-end gap-0.5">
        <span className="tabular-nums font-medium">{formatRub(row.original.sales30dRub)}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">{formatInt(row.original.sales30dUnits)} шт.</span>
      </div>
    ),
  },
  {
    id: 'sparkline',
    header: 'Тренд 30д',
    cell: ({ row }) => {
      const data = row.original.salesSparkline;
      const first = data[0] ?? 0;
      const last = data[data.length - 1] ?? 0;
      const trend = last > first ? 'up' : last < first ? 'down' : 'flat';
      return <Sparkline data={data} trend={trend} width={80} height={24} />;
    },
    enableSorting: false,
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
    accessorKey: 'stock',
    header: 'Остаток',
    cell: ({ row }) => (
      <div className="flex flex-col items-end gap-0.5">
        <span
          className={cn(
            'tabular-nums',
            row.original.stock === 0 ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-foreground',
          )}
        >
          {formatInt(row.original.stock)} шт.
        </span>
        {row.original.inTransit > 0 && (
          <span className="text-[11px] tabular-nums text-muted-foreground">+ {formatInt(row.original.inTransit)} в пути</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'daysOfStock',
    header: 'Хватит',
    cell: ({ row }) => {
      const d = row.original.daysOfStock;
      const tone =
        d === 0
          ? 'text-rose-600 dark:text-rose-400 font-semibold'
          : d < 7
            ? 'text-rose-600 dark:text-rose-400'
            : d > 90
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-foreground';
      return <span className={cn('tabular-nums', tone)}>{d} д.</span>;
    },
  },
  {
    accessorKey: 'lastSaleDaysAgo',
    header: 'Посл. продажа',
    cell: ({ row }) => {
      const d = row.original.lastSaleDaysAgo;
      if (d === 0) return <span className="text-emerald-600 dark:text-emerald-400 font-medium">Сегодня</span>;
      if (d === 1) return <span className="text-foreground">Вчера</span>;
      if (d < 7) return <span className="text-foreground">{d} д. назад</span>;
      if (d < 30) return <span className="text-amber-600 dark:text-amber-400">{d} д. назад</span>;
      return <span className="text-rose-600 dark:text-rose-400 font-medium">{d} д. назад</span>;
    },
  },
];
