/**
 * DataTablePro — обёртка TanStack Table v8 со встроенными:
 * sort, column resize/reorder, presets, virtualization, sticky-колонка,
 * row-select + bulk-actions footer, server-side data, expandable rows, экспорт Excel/CSV.
 *
 * TODO M0.2: полная реализация поверх примитива <table> + @tanstack/react-table.
 */
export type DataTableProProps<T> = {
  data: T[];
  // columns: ColumnDef<T>[]; — добавим при имплементации
};

export function DataTablePro<T>({ data }: DataTableProProps<T>) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
      DataTablePro skeleton · {data.length} rows · реализация в следующем PR
    </div>
  );
}
