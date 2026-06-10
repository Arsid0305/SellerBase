'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/shared/ui/badge';
import { Sparkline } from '@/shared/ui/domain/sparkline';
import { formatRub, formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_TYPE_LABEL, type AdCampaign } from './types';

export const campaignsColumns: ColumnDef<AdCampaign, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Кампания',
    cell: ({ row }) => (
      <div className="flex min-w-[240px] flex-col gap-0.5">
        <span className="font-medium leading-tight">{row.original.name}</span>
        <span className="text-[11px] text-muted-foreground">{CAMPAIGN_TYPE_LABEL[row.original.type]}</span>
      </div>
    ),
  },
  {
    accessorKey: 'marketplace',
    header: 'Канал',
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={cn(
          'font-mono text-[10px]',
          row.original.marketplace === 'WB' && 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400',
          row.original.marketplace === 'OZON' && 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
        )}
      >
        {row.original.marketplace}
      </Badge>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Статус',
    cell: ({ row }) => {
      const s = row.original.status;
      const tone =
        s === 'active'
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : s === 'paused'
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
            : 'border-border bg-muted text-muted-foreground';
      return (
        <Badge variant="outline" className={cn('text-[10px]', tone)}>
          {CAMPAIGN_STATUS_LABEL[s]}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'dailyBudget',
    header: 'Бюджет/день',
    cell: ({ row }) => <span className="tabular-nums">{formatRub(row.original.dailyBudget)}</span>,
  },
  {
    accessorKey: 'cpc',
    header: 'CPC',
    cell: ({ row }) => {
      const v = row.original.cpc;
      const tone =
        v < 5
          ? 'text-emerald-600 dark:text-emerald-400'
          : v > 20
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-foreground';
      return <span className={cn('tabular-nums', tone)}>{v.toFixed(2)} ₽</span>;
    },
  },
  {
    accessorKey: 'clicks',
    header: 'Клики',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="tabular-nums">{formatInt(row.original.clicks)}</span>
        <Sparkline data={row.original.clicks14d} trend="flat" width={60} height={20} />
      </div>
    ),
  },
  {
    accessorKey: 'orders',
    header: 'Заказы',
    cell: ({ row }) => <span className="tabular-nums">{formatInt(row.original.orders)}</span>,
  },
  {
    accessorKey: 'conversionRate',
    header: 'CR',
    cell: ({ row }) => {
      const v = row.original.conversionRate;
      const tone = v < 2 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400';
      return <span className={cn('tabular-nums font-medium', tone)}>{v.toFixed(2)}%</span>;
    },
  },
  {
    accessorKey: 'spend',
    header: 'Расход',
    cell: ({ row }) => <span className="tabular-nums">{formatRub(row.original.spend)}</span>,
  },
  {
    accessorKey: 'revenue',
    header: 'Выручка',
    cell: ({ row }) => <span className="tabular-nums">{formatRub(row.original.revenue)}</span>,
  },
  {
    accessorKey: 'roas',
    header: 'ROAS',
    cell: ({ row }) => {
      const v = row.original.roas;
      const tone =
        v < 2
          ? 'text-rose-600 dark:text-rose-400'
          : v <= 4
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-emerald-600 dark:text-emerald-400';
      return <span className={cn('tabular-nums font-medium', tone)}>{v.toFixed(2)}×</span>;
    },
  },
];
