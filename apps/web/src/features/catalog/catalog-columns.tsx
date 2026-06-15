'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { ProductTagBadge } from '@/shared/ui/domain/product-tag-badge';
import { LifecycleBadge } from '@/shared/ui/domain/lifecycle-badge';
import { Sparkline } from '@/shared/ui/domain/sparkline';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { TooltipIcon } from '@/shared/ui/tooltip-icon';
import { formatRub, formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { CatalogProduct } from './types';

const LIFECYCLE_TOOLTIP =
  'NEW — новый (<14д). LEADER — топ-20% по выручке + маржа ≥20%. GROWING — выручка ↑ ≥20% к прошлому периоду. STABLE — колебания ±20%. DECLINING — падение ≥20%. CRITICAL — нет остатка при спросе или без продаж >14д. ARCHIVED — выведен из оборота.';

const TVV_TOOLTIP =
  'Видимость = % дней с продажами за период. Доверие = стабильность спроса (1 − коэф. вариации). Ценность = маржа% × 2 (нормализовано 0–100).';

const TAGS_TOOLTIP =
  'ABC — место по выручке (A: топ-80%, B: 15%, C: 5%). XYZ — стабильность спроса (X: ровно, Y: средне, Z: рывками). PPP/PP/P/-P — рентабельность (PPP: маржа ≥30%, PP: 20–30%, P: 10–20%, -P: убыточный). FBO/FBS — схема хранения.';

export const catalogColumns: ColumnDef<CatalogProduct, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Товар',
    cell: ({ row }) => (
      <Link
        href={`/products/${encodeURIComponent(row.original.barcode)}`}
        className="flex min-w-[200px] items-center gap-2 hover:underline"
      >
        <SkuThumb src={row.original.photoUrl} alt={row.original.name} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium leading-tight">{row.original.name}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{row.original.barcode}</span>
        </div>
      </Link>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'category',
    header: 'Категория',
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.category}</span>,
    enableSorting: false,
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
    enableSorting: false,
  },
  {
    id: 'tags',
    header: () => (
      <span className="inline-flex items-center gap-1">
        Метки
        <TooltipIcon text={TAGS_TOOLTIP} />
      </span>
    ),
    cell: ({ row }) => {
      const tags = row.original.tags;
      if (tags.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <div className="flex flex-wrap items-center gap-1">
          {tags.map((tag) => (
            <ProductTagBadge key={tag} kind={tag} />
          ))}
        </div>
      );
    },
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
    enableSorting: false,
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
    enableSorting: false,
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
    enableSorting: false,
  },
  {
    accessorKey: 'daysOfStock',
    header: () => (
      <span className="inline-flex items-center gap-1">
        Хватит
        <TooltipIcon text="На сколько дней хватит текущего остатка при средних продажах за 30 дней. Это и есть оборачиваемость в днях." />
      </span>
    ),
    cell: ({ row }) => {
      const d = row.original.daysOfStock;
      const stock = row.original.stock;
      if (stock === 0 && d === 0) return <span className="text-xs text-muted-foreground">—</span>;
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
    enableSorting: false,
  },
  {
    id: 'tvv',
    header: () => (
      <span className="inline-flex items-center gap-1">
        В / Д / Ц
        <TooltipIcon text={TVV_TOOLTIP} />
      </span>
    ),
    enableSorting: false,
    cell: ({ row }) => {
      const { visibility, trust, value } = row.original;
      return (
        <span
          className="font-mono text-[11px] tabular-nums text-muted-foreground"
          title={`Видимость ${visibility} · Доверие ${trust} · Ценность ${value}`}
        >
          {visibility}/{trust}/{value}
        </span>
      );
    },
  },
];
