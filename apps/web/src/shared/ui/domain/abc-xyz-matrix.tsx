import { cn } from '@/shared/lib/utils';

/**
 * AbcXyzMatrix — 2D-грид товаров по двум классификаторам.
 * По умолчанию 4 × 3 (PPP/PP/P/-P × X/Y/Z).
 * TODO M4: цветовые зоны, hover-tooltip с KPI, drill-down кликом.
 */
export type AbcXyzCell = { row: string; col: string; count: number };

export function AbcXyzMatrix({
  rows = ['PPP', 'PP', 'P', '-P'],
  cols = ['X', 'Y', 'Z'],
  cells = [],
}: {
  rows?: string[];
  cols?: string[];
  cells?: AbcXyzCell[];
}) {
  const lookup = new Map(cells.map((c) => [`${c.row}|${c.col}`, c.count]));
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid" style={{ gridTemplateColumns: `auto repeat(${cols.length}, 1fr)` }}>
        <div className="bg-muted/50 p-3" />
        {cols.map((c) => (
          <div key={c} className="bg-muted/50 p-3 text-center text-sm font-medium">
            {c}
          </div>
        ))}
        {rows.map((r) => (
          <RowGroup key={r} row={r} cols={cols} lookup={lookup} />
        ))}
      </div>
    </div>
  );
}

function RowGroup({
  row,
  cols,
  lookup,
}: {
  row: string;
  cols: string[];
  lookup: Map<string, number>;
}) {
  return (
    <>
      <div className="bg-muted/50 p-3 text-sm font-medium">{row}</div>
      {cols.map((c) => {
        const count = lookup.get(`${row}|${c}`) ?? 0;
        return (
          <div
            key={c}
            className={cn(
              'border-l border-t border-border p-4 text-center text-sm',
              count > 0 ? 'cursor-pointer hover:bg-accent' : 'text-muted-foreground',
            )}
          >
            {count} шт.
          </div>
        );
      })}
    </>
  );
}
