import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';
import type { ProfitabilityCell, ProfitTier, SalesTier } from './types';

const PROFIT_ROWS: { tier: ProfitTier; label: string; description: string }[] = [
  { tier: 'PPP', label: 'PPP', description: 'Очень высокая прибыльность' },
  { tier: 'PP', label: 'PP', description: 'Высокая прибыльность' },
  { tier: 'P', label: 'P', description: 'Средняя прибыльность' },
  { tier: '-P', label: '-P', description: 'Убыток' },
];

const SALES_COLS: { tier: SalesTier; label: string; description: string }[] = [
  { tier: 'A', label: 'A', description: 'Много продаж' },
  { tier: 'B', label: 'B', description: 'Умеренно продаж' },
  { tier: 'C', label: 'C', description: 'Мало продаж' },
];

const ZONE_COLOR: Record<`${ProfitTier}_${SalesTier}`, string> = {
  PPP_A: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  PPP_B: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  PPP_C: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/15',
  PP_A: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  PP_B: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
  PP_C: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/15',
  P_A: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
  P_B: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/15',
  P_C: 'bg-amber-500/8 text-amber-700 dark:text-amber-300 border-amber-500/10',
  '-P_A': 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30',
  '-P_B': 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20',
  '-P_C': 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/15',
};

export function ProfitabilityMatrix({
  cells,
  selectedProfit = null,
  selectedSales = null,
}: {
  cells: ProfitabilityCell[];
  selectedProfit?: ProfitTier | null;
  selectedSales?: SalesTier | null;
}) {
  const lookup = new Map(cells.map((c) => [`${c.profit}_${c.sales}`, c.count]));
  const total = cells.reduce((acc, c) => acc + c.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Анализ товаров по прибыльности и продажам</CardTitle>
        <p className="text-xs text-muted-foreground">Всего {total} товаров</p>
      </CardHeader>
      <CardContent>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `auto repeat(${SALES_COLS.length}, minmax(0, 1fr))` }}
        >
          <div />
          {SALES_COLS.map((col) => (
            <div key={col.tier} className="flex flex-col items-center gap-0.5 pb-2">
              <span className="inline-flex size-7 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {col.label}
              </span>
              <span className="text-[10px] text-muted-foreground">{col.description}</span>
            </div>
          ))}

          {PROFIT_ROWS.map((row) => (
            <RowGroup
              key={row.tier}
              row={row}
              cols={SALES_COLS}
              lookup={lookup}
              selectedProfit={selectedProfit}
              selectedSales={selectedSales}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RowGroup({
  row,
  cols,
  lookup,
  selectedProfit,
  selectedSales,
}: {
  row: { tier: ProfitTier; label: string; description: string };
  cols: { tier: SalesTier; label: string; description: string }[];
  lookup: Map<string, number>;
  selectedProfit: ProfitTier | null;
  selectedSales: SalesTier | null;
}) {
  return (
    <>
      <div className="flex flex-col items-end gap-0.5 self-center pr-2">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {row.label}
        </span>
        <span className="text-right text-[10px] text-muted-foreground">{row.description}</span>
      </div>
      {cols.map((col) => {
        const count = lookup.get(`${row.tier}_${col.tier}`) ?? 0;
        const colorKey = `${row.tier}_${col.tier}` as keyof typeof ZONE_COLOR;
        const isSelected = selectedProfit === row.tier && selectedSales === col.tier;
        const baseClass = cn(
          'flex aspect-[2/1] flex-col items-center justify-center rounded-lg border text-center transition-colors',
          count > 0
            ? `${ZONE_COLOR[colorKey]} hover:brightness-110`
            : 'border-dashed border-border bg-muted/30 text-muted-foreground',
          isSelected && 'ring-2 ring-offset-2 ring-foreground/60',
        );
        const content = (
          <>
            <span className="text-2xl font-semibold tabular-nums">{count}</span>
            <span className="text-[10px] uppercase tracking-wider opacity-80">шт.</span>
          </>
        );
        if (count > 0) {
          return (
            <Link
              key={col.tier}
              href={`/analytics?profit=${encodeURIComponent(row.tier)}&sales=${col.tier}#group`}
              scroll
              className={baseClass}
            >
              {content}
            </Link>
          );
        }
        return (
          <div key={col.tier} className={baseClass}>
            {content}
          </div>
        );
      })}
    </>
  );
}
