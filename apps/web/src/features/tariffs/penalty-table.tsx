'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { Badge } from '@/shared/ui/badge';
import { formatRub } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { CsvColumn } from '@/shared/lib/csv';
import { MarketplaceBadge } from './marketplace-badge';
import { mockPenalties } from './mock-data';
import type { PenaltyTariff, PenaltySeverity } from './types';

const SEVERITY_ORDER: Record<PenaltySeverity, number> = { low: 0, mid: 1, high: 2 };

function amountTone(severity: PenaltySeverity): string {
  if (severity === 'low') return 'text-amber-600 dark:text-amber-400';
  if (severity === 'mid') return 'text-rose-600 dark:text-rose-400';
  return 'text-rose-700 dark:text-rose-300 font-bold';
}

function SeverityBadge({ severity }: { severity: PenaltySeverity }) {
  if (severity === 'high') {
    return <Badge variant="destructive" className="text-[10px]">высокий</Badge>;
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px]',
        severity === 'low' && 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        severity === 'mid' && 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
      )}
    >
      {severity === 'low' ? 'низкий' : 'средний'}
    </Badge>
  );
}

const columns: ColumnDef<PenaltyTariff, unknown>[] = [
  {
    accessorKey: 'marketplace',
    header: 'Канал',
    cell: ({ row }) => <MarketplaceBadge marketplace={row.original.marketplace} />,
  },
  {
    accessorKey: 'reason',
    header: 'Причина',
    cell: ({ row }) => <span className="font-medium">{row.original.reason}</span>,
  },
  {
    accessorKey: 'amount',
    header: 'Сумма',
    cell: ({ row }) => (
      <span className={cn('tabular-nums', amountTone(row.original.severity))}>
        {formatRub(row.original.amount)}
      </span>
    ),
  },
  {
    accessorKey: 'unit',
    header: 'Единица',
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-[10px] text-muted-foreground">
        {row.original.unit}
      </Badge>
    ),
  },
  {
    accessorKey: 'severity',
    header: 'Тяжесть',
    cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
    sortingFn: (a, b) => SEVERITY_ORDER[a.original.severity] - SEVERITY_ORDER[b.original.severity],
  },
];

const CSV_COLUMNS: CsvColumn<PenaltyTariff>[] = [
  { key: 'marketplace', label: 'Канал' },
  { key: 'reason', label: 'Причина' },
  { key: 'amount', label: 'Сумма ₽' },
  { key: 'unit', label: 'Единица' },
  { key: 'severity', label: 'Тяжесть' },
];

export function PenaltyTable() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Штрафы и их размеры</span>
        <ExportCsvButton rows={mockPenalties} columns={CSV_COLUMNS} filename="tariffs-penalties" />
      </div>
      <DataTable
        data={mockPenalties}
        columns={columns}
        initialSort={[{ id: 'severity', desc: true }]}
        rowKey={(row) => row.id}
        empty="Нет штрафов"
      />
    </div>
  );
}
