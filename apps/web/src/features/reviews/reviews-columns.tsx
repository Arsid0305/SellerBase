'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Star } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { TooltipIcon } from '@/shared/ui/tooltip-icon';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { Review } from './types';

const SENTIMENT_TOOLTIP =
  'Тональность определяется автоматически по тексту отзыва: позитив, нейтрально или негатив.';

function ratingTone(rating: number): string {
  if (rating >= 4.5) return 'text-emerald-600 dark:text-emerald-400';
  if (rating < 3.5) return 'text-rose-600 dark:text-rose-400';
  return 'text-amber-600 dark:text-amber-400';
}

function RatingStars({ rating }: { rating: number }) {
  const tone = ratingTone(rating);
  return (
    <div className="flex items-center gap-1" title={`${rating}/5`}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              'size-3.5',
              i < rating ? cn('fill-current', tone) : 'fill-transparent text-muted-foreground/30',
            )}
          />
        ))}
      </div>
      <span className={cn('text-xs font-medium tabular-nums', tone)}>{rating}</span>
    </div>
  );
}

export const reviewsColumns: ColumnDef<Review, unknown>[] = [
  {
    accessorKey: 'rating',
    header: 'Оценка',
    cell: ({ row }) => <RatingStars rating={row.original.rating} />,
  },
  {
    accessorKey: 'text',
    header: 'Отзыв',
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex max-w-md flex-col gap-1">
        <p className="line-clamp-2 text-sm leading-snug" title={row.original.text}>
          {row.original.text}
        </p>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {row.original.author} · {formatDate(row.original.date)}
        </span>
      </div>
    ),
  },
  {
    accessorKey: 'productName',
    header: 'Товар',
    cell: ({ row }) => (
      <Link
        href={`/products/${encodeURIComponent(row.original.productBarcode)}`}
        className="flex min-w-[200px] items-center gap-2 hover:underline"
      >
        <SkuThumb src={row.original.photoUrl} alt={row.original.productName} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium leading-tight">{row.original.productName}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{row.original.productBarcode}</span>
        </div>
      </Link>
    ),
    enableSorting: false,
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
    accessorKey: 'sentiment',
    header: () => (
      <span className="inline-flex items-center gap-1">
        Тональность
        <TooltipIcon text={SENTIMENT_TOOLTIP} />
      </span>
    ),
    cell: ({ row }) => {
      const s = row.original.sentiment;
      const label = s === 'positive' ? 'Позитив' : s === 'negative' ? 'Негатив' : 'Нейтрально';
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-[11px]',
            s === 'positive' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
            s === 'negative' && 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
            s === 'neutral' && 'text-muted-foreground',
          )}
        >
          {label}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'responseStatus',
    header: 'Ответ',
    cell: ({ row }) => {
      const st = row.original.responseStatus;
      const label = st === 'answered' ? 'Отвечено' : st === 'pending' ? 'Ждёт ответа' : 'Без ответа';
      return (
        <Badge
          variant="outline"
          className={cn(
            'text-[11px]',
            st === 'answered' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
            st === 'pending' && 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
            st === 'ignored' && 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
          )}
        >
          {label}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'date',
    header: 'Дата',
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground">{formatDate(row.original.date)}</span>
    ),
  },
];
