'use client';

import { useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  initialSort?: SortingState;
  empty?: ReactNode;
  className?: string;
  rowKey?: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
};

/**
 * Минимальный DataTable поверх @tanstack/react-table.
 * Сейчас: сортировка. Дальше поверх этого: виртуализация, resize, presets, export.
 */
export function DataTable<T>({ data, columns, initialSort = [], empty, className, rowKey, rowClassName }: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSort);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border bg-card', className)}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-border bg-muted/40">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sortDir = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className={cn(
                      'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground',
                      canSort && 'cursor-pointer select-none hover:text-foreground',
                    )}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <SortIcon dir={sortDir === 'asc' ? 'asc' : sortDir === 'desc' ? 'desc' : 'none'} />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-12 text-center text-muted-foreground" colSpan={columns.length}>
                {empty ?? 'Нет данных'}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={rowKey ? rowKey(row.original) : row.id}
              className={cn(
                'border-b border-border last:border-b-0 hover:bg-accent/30',
                rowClassName?.(row.original),
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortIcon({ dir }: { dir: 'asc' | 'desc' | 'none' }) {
  if (dir === 'asc') return <ChevronUp className="size-3.5" />;
  if (dir === 'desc') return <ChevronDown className="size-3.5" />;
  return <ChevronsUpDown className="size-3.5 opacity-50" />;
}
