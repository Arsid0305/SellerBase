'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/shared/ui/domain/data-table';
import { ExportCsvButton } from '@/shared/ui/domain/export-button';
import { formatRub } from '@/shared/lib/format';
import type { CsvColumn } from '@/shared/lib/csv';
import type { ParetoItem } from '@/entities/pareto';
import { ZoneBadge } from './zone-badge';

const numberFmt = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const columns: ColumnDef<ParetoItem, unknown>[] = [
  {
    accessorKey: 'rank',
    header: 'Ранг',
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">#{row.original.rank}</span>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Товар',
    cell: ({ row }) => (
      <Link
        href={`/products/${encodeURIComponent(row.original.barcode)}`}
        className="flex min-w-[240px] flex-col gap-0.5 hover:underline"
      >
        <span className="font-medium leading-tight">{row.original.name}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{row.original.barcode || '—'}</span>
      </Link>
    ),
  },
  {
    accessorKey: 'revenue',
    header: 'Выручка',
    cell: ({ row }) => (
      <span className="tabular-nums font-medium">{formatRub(row.original.revenue)}</span>
    ),
  },
  {
    accessorKey: 'sharePct',
    header: 'Доля',
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{numberFmt.format(row.original.sharePct)}%</span>
    ),
  },
  {
    accessorKey: 'cumPct',
    header: 'Кум. доля',
    cell: ({ row }) => (
      <span className="tabular-nums">{numberFmt.format(row.original.cumPct)}%</span>
    ),
  },
  {
    accessorKey: 'zone',
    header: 'Зона',
    cell: ({ row }) => <ZoneBadge zone={row.original.zone} />,
  },
];

const CSV_COLUMNS: CsvColumn<ParetoItem>[] = [
  { key: 'rank', label: 'Ранг' },
  { key: 'name', label: 'Товар' },
  { key: 'barcode', label: 'Штрихкод' },
  { key: 'revenue', label: 'Выручка' },
  { key: 'sharePct', label: 'Доля %' },
  { key: 'cumPct', label: 'Кум. доля %' },
  { key: 'zone', label: 'Зона' },
];

export function ParetoTable({ items }: { items: ParetoItem[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Показано {items.length} SKU</span>
        <ExportCsvButton rows={items} columns={CSV_COLUMNS} filename="pareto" />
      </div>
      <DataTable
        data={items}
        columns={columns}
        initialSort={[{ id: 'rank', desc: false }]}
        rowKey={(row) => String(row.skuId)}
        empty="Нет SKU с продажами за выбранный период"
      />
    </div>
  );
}
