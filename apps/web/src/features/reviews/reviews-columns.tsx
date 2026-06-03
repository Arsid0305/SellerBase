'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Star } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { Review } from './types';

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" title={`${rating}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'size-3.5',
            i < rating
              ? 'fill-amber-500 text-amber-500'
              : 'fill-transparent text-muted-foreground/30',
          )}
        />
      ))}
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
        className="flex min-w-[200px] flex-col gap-0.5 hover:underline"
      >
        <span className="text-sm font-medium leading-tight">{row.original.productName}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{row.original.productBarcode}</span>
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
    accessorKey: 'sentiment',
    header: 'Тональность',
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
