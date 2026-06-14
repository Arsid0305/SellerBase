'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { ProductTagBadge } from '@/shared/ui/domain/product-tag-badge';
import { LifecycleBadge } from '@/shared/ui/domain/lifecycle-badge';
import { Sparkline } from '@/shared/ui/domain/sparkline';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { Badge } from '@/shared/ui/badge';
import { TooltipIcon } from '@/shared/ui/tooltip-icon';
import { formatRub, formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { CatalogProduct } from './types';

const LIFECYCLE_TOOLTIP =
  'NEW — новый (<14д). LEADER — топ-20% по выручке + маржа ≥20%. GROWING — выручка ↑ ≥20% к прошлому периоду. STABLE — колебания ±20%. DECLINING — падение ≥20%. CRITICAL — нет остатка при спросе или без продаж >14д. ARCHIVED — выведен из оборота.';

const TVV_TOOLTIP =
  'Видимость = % дней с продажами за период. Доверие = стабильность спроса (1 − коэф. вариации). Ценность = маржа% × 2 (нормализовано 0–100).';

export const catalogColumns: ColumnDef<CatalogProduct, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Товар',
    cell: ({ row }) => (
      <Link
        href={`/products/${encodeURIComponent(row.original.barcode)}`}
        className="flex min-w-[260px] items-center gap-2 hover:underline"
      >
        <SkuThumb src={row.original.photoUrl} alt={row.original.name} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium leading-tight">{row.original.name}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{row.original.barcode}</span>
        </div>
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
    accessorFn: (row) => row.lifecycle ?? 'STABLE',
    header: () => (
      <span className="inline-flex items-center gap-1">
        Состояние
        <TooltipIcon text={LIFECYCLE_TOOLTIP} />
      </span>
    ),
    cell: ({ row }) => <LifecycleBadge state={row.original.lifecycle ?? 'STABLE'} showDescription />,
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
  {
    id: 'tvv',
    header: () => (
      <span className="inline-flex items-center gap-1">
        Видимость / Доверие / Ценность
        <TooltipIcon text={TVV_TOOLTIP} />
      </span>
    ),
    enableSorting: false,
    cell: ({ row }) => {
      const { visibility, trust, value } = row.original;
      const Bar = ({ pct, label, color }: { pct: number; label: string; color: string }) => (
        <div className="flex items-center gap-1">
          <span className="w-10 text-[10px] text-muted-foreground">{label}</span>
          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
            <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="w-7 text-right text-[10px] tabular-nums">{pct}</span>
        </div>
      );
      return (
        <div className="flex flex-col gap-0.5">
          <Bar pct={visibility} label="Вид." color="bg-sky-500" />
          <Bar pct={trust} label="Дов." color="bg-emerald-500" />
          <Bar pct={value} label="Цен." color="bg-violet-500" />
        </div>
      );
    },
  },
];
