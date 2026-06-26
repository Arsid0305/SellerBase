import Link from 'next/link';
import { X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { formatRub, formatInt } from '@/shared/lib/format';
import type { AnalyticsRow, ProfitTier, SalesTier, StabilityTier } from './types';

const PROFIT_DESC: Record<ProfitTier, string> = {
  PPP: 'маржа ≥ 30%',
  PP: 'маржа 15–30%',
  P: 'маржа 0–15%',
  '-P': 'убыток',
};
const SALES_DESC: Record<SalesTier, string> = {
  A: 'верхние 80% выручки',
  B: 'следующие 15%',
  C: 'последние 5%',
};
const STAB_DESC: Record<StabilityTier, string> = {
  X: 'коэф. вариации < 10%',
  Y: 'коэф. вариации 10–25%',
  Z: 'коэф. вариации > 25% или мало данных',
};

function buildTitle(profit: ProfitTier | null, sales: SalesTier | null, stability: StabilityTier | null): string {
  if (stability) {
    const map: Record<StabilityTier, string> = {
      X: 'Стабильные продажи (X)',
      Y: 'Средняя стабильность (Y)',
      Z: 'Нестабильные продажи (Z)',
    };
    return map[stability];
  }
  if (profit && sales) return `Группа ${profit} × ${sales}`;
  if (profit) return `Группа ${profit}`;
  if (sales) return `Группа ${sales}`;
  return 'Группа';
}

function buildDescription(profit: ProfitTier | null, sales: SalesTier | null, stability: StabilityTier | null): string {
  const parts: string[] = [];
  if (profit) parts.push(PROFIT_DESC[profit]);
  if (sales) parts.push(SALES_DESC[sales]);
  if (stability) parts.push(STAB_DESC[stability]);
  return parts.join(' · ');
}

export function AnalyticsGroupSection({
  rows,
  profit,
  sales,
  stability,
}: {
  rows: AnalyticsRow[];
  profit: ProfitTier | null;
  sales: SalesTier | null;
  stability: StabilityTier | null;
}) {
  const title = buildTitle(profit, sales, stability);
  const description = buildDescription(profit, sales, stability);
  const totalRevenue = rows.reduce((acc, r) => acc + r.revenue, 0);
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">
            {title} · {rows.length} товаров
          </CardTitle>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <Link
          href="/analytics"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
          aria-label="Закрыть"
        >
          <X className="size-3.5" />
          Закрыть
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">В этой группе пока нет товаров.</div>
        ) : (
          <>
            <div className="flex items-center justify-between border-y border-border px-5 py-2 text-xs text-muted-foreground">
              <span>
                Показано: <span className="font-medium text-foreground">{rows.length}</span> товаров
              </span>
              <span>
                Выручка группы: <span className="font-medium text-foreground">{formatRub(totalRevenue)}</span>
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-medium">Товар</th>
                  <th className="px-5 py-2 text-right font-medium">Выручка</th>
                  <th className="px-5 py-2 text-right font-medium">Маржа</th>
                  <th className="px-5 py-2 text-right font-medium">Остаток</th>
                  <th className="px-5 py-2 text-right font-medium">Продано</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-b-0 hover:bg-accent/30">
                    <td className="px-5 py-2">
                      <Link href={`/products/${r.id}`} className="flex items-center gap-2 hover:underline">
                        <SkuThumb src={r.photoUrl} alt={r.name} />
                        <div className="flex min-w-0 flex-col">
                          <span className="line-clamp-1">{r.name}</span>
                          <span className="text-xs text-muted-foreground">{r.barcode || '—'}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums">{formatRub(r.revenue)}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{r.margin.toFixed(1)}%</td>
                    <td className="px-5 py-2 text-right tabular-nums">{formatInt(r.stock)}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{formatInt(r.unitsSold)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
