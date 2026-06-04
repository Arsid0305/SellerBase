'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Sparkline } from '@/shared/ui/domain/sparkline';
import { formatRub, formatInt, formatCompact } from '@/shared/lib/format';
import type { SearchQuery } from './types';

export const queriesColumns: ColumnDef<SearchQuery, unknown>[] = [
  {
    accessorKey: 'text',
    header: 'Запрос',
    cell: ({ row }) => <span className="font-medium">{row.original.text}</span>,
  },
  {
    accessorKey: 'frequency',
    header: 'Частотность / день',
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{formatCompact(row.original.frequency)}</span>
    ),
  },
  {
    accessorKey: 'competitorCount',
    header: 'Товаров в выдаче',
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{formatInt(row.original.competitorCount)}</span>
    ),
  },
  {
    accessorKey: 'avgCpc',
    header: 'Средний CPC',
    cell: ({ row }) => <span className="tabular-nums">{formatRub(row.original.avgCpc)}</span>,
  },
  {
    id: 'trend7d',
    header: 'Тренд (7 дн)',
    cell: ({ row }) => {
      const d = row.original.trend7d;
      const trend = d[d.length - 1] > d[0] ? 'up' : d[d.length - 1] < d[0] ? 'down' : 'flat';
      return <Sparkline data={d} trend={trend} width={72} height={22} />;
    },
    enableSorting: false,
  },
];
