import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/widgets/app-shell/page-header';
import { SkuThumb } from '@/shared/ui/domain/sku-thumb';
import { formatRub, formatInt } from '@/shared/lib/format';
import { fetchAnalytics } from '@/entities/analytics';
import type { ProfitTier, SalesTier, StabilityTier } from '@/features/analytics/types';

export const metadata = { title: 'Группа товаров' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Promise<{ profit?: string; sales?: string; stability?: string }>;

const PROFIT_VALUES: ProfitTier[] = ['PPP', 'PP', 'P', '-P'];
const SALES_VALUES: SalesTier[] = ['A', 'B', 'C'];
const STAB_VALUES: StabilityTier[] = ['X', 'Y', 'Z'];

function parseTier<T extends string>(v: string | undefined, allowed: T[]): T | null {
  if (!v) return null;
  return allowed.includes(v as T) ? (v as T) : null;
}

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
  return 'Группа товаров';
}

function buildDescription(profit: ProfitTier | null, sales: SalesTier | null, stability: StabilityTier | null): string {
  const parts: string[] = [];
  if (profit) {
    const m: Record<ProfitTier, string> = {
      PPP: 'маржа ≥ 30%',
      PP: 'маржа 15–30%',
      P: 'маржа 0–15%',
      '-P': 'убыток',
    };
    parts.push(m[profit]);
  }
  if (sales) {
    const m: Record<SalesTier, string> = {
      A: 'верхние 80% выручки',
      B: 'следующие 15%',
      C: 'последние 5%',
    };
    parts.push(m[sales]);
  }
  if (stability) {
    const m: Record<StabilityTier, string> = {
      X: 'коэф. вариации < 10%',
      Y: 'коэф. вариации 10–25%',
      Z: 'коэф. вариации > 25% или мало данных',
    };
    parts.push(m[stability]);
  }
  return parts.join(' · ');
}

export default async function AnalyticsGroupPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const profit = parseTier(sp.profit, PROFIT_VALUES);
  const sales = parseTier(sp.sales, SALES_VALUES);
  const stability = parseTier(sp.stability, STAB_VALUES);

  const { rows } = await fetchAnalytics();
  const filtered = rows.filter((r) => {
    if (profit && r.profit !== profit) return false;
    if (sales && r.sales !== sales) return false;
    if (stability && r.stability !== stability) return false;
    return true;
  });

  const title = buildTitle(profit, sales, stability);
  const description = buildDescription(profit, sales, stability);
  const totalRevenue = filtered.reduce((acc, r) => acc + r.revenue, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title={`${title} · ${filtered.length} товаров`} description={description || 'Список товаров группы'} />
        <Link
          href="/analytics"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          К аналитике
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          В этой группе пока нет товаров.
        </div>
      ) : (
        <div className="rounded-md border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3 text-xs text-muted-foreground">
            <span>Показано: <span className="font-medium text-foreground">{filtered.length}</span> товаров</span>
            <span>Выручка группы: <span className="font-medium text-foreground">{formatRub(totalRevenue)}</span></span>
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
              {filtered
                .sort((a, b) => b.revenue - a.revenue)
                .map((r) => (
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
        </div>
      )}
    </div>
  );
}
