import Link from 'next/link';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { formatRub } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { PnlSkuRow } from '@/entities/pnl';

export type SkuDiffRow = {
  sku_id: number;
  title: string;
  revenueA: number;
  revenueB: number;
  delta: number;
  deltaPct: number;
};

export function buildSkuDiffs(rowsA: PnlSkuRow[], rowsB: PnlSkuRow[]): SkuDiffRow[] {
  const mapA = new Map<number, PnlSkuRow>();
  const mapB = new Map<number, PnlSkuRow>();
  for (const r of rowsA) mapA.set(r.sku_id, r);
  for (const r of rowsB) mapB.set(r.sku_id, r);
  const ids = new Set<number>([...mapA.keys(), ...mapB.keys()]);
  const out: SkuDiffRow[] = [];
  for (const id of ids) {
    const a = mapA.get(id);
    const b = mapB.get(id);
    const revenueA = a ? Number(a.revenue_rub) || 0 : 0;
    const revenueB = b ? Number(b.revenue_rub) || 0 : 0;
    const delta = revenueA - revenueB;
    const deltaPct = revenueB === 0 ? (revenueA === 0 ? 0 : 100) : (delta / Math.abs(revenueB)) * 100;
    const sample = a ?? b;
    const title = sample?.my_article || (sample?.wb_article ? String(sample.wb_article) : `SKU ${id}`);
    out.push({ sku_id: id, title, revenueA, revenueB, delta, deltaPct });
  }
  return out;
}

export function SkuDiffTables({ rows }: { rows: SkuDiffRow[] }) {
  const growers = [...rows].sort((a, b) => b.delta - a.delta).slice(0, 5);
  const losers = [...rows].sort((a, b) => a.delta - b.delta).slice(0, 5);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <DiffCard title="Топ роста" rows={growers} />
      <DiffCard title="Топ падения" rows={losers} />
    </div>
  );
}

function DiffCard({ title, rows }: { title: string; rows: SkuDiffRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет данных.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Товар</th>
                <th className="py-2 pr-3 text-right font-medium">Δ ₽</th>
                <th className="py-2 text-right font-medium">Δ %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const positive = r.delta > 0;
                const tone = positive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : r.delta < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-muted-foreground';
                const Icon = r.delta >= 0 ? ArrowUp : ArrowDown;
                return (
                  <tr key={r.sku_id} className="border-b border-border/50 last:border-b-0">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/products/${r.sku_id}`}
                        className="text-foreground hover:underline"
                      >
                        {r.title}
                      </Link>
                    </td>
                    <td className={cn('py-2 pr-3 text-right tabular-nums', tone)}>
                      <span className="inline-flex items-center gap-1">
                        <Icon className="size-3" />
                        {formatRub(Math.abs(r.delta))}
                      </span>
                    </td>
                    <td className={cn('py-2 text-right tabular-nums', tone)}>
                      {r.deltaPct > 0 ? '+' : r.deltaPct < 0 ? '−' : ''}
                      {Math.abs(r.deltaPct).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
