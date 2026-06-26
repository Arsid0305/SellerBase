import { PageHeader } from '@/widgets/app-shell/page-header';
import {
  ProfitabilityMatrix,
  StabilitySegments,
  AnalyticsSummaryCards,
  AnalyticsTable,
  AnalyticsGroupSection,
} from '@/features/analytics';
import { fetchAnalytics } from '@/entities/analytics';
import type { ProfitTier, SalesTier, StabilityTier } from '@/features/analytics/types';

export const metadata = { title: 'Товарная аналитика' };
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

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const profit = parseTier(sp.profit, PROFIT_VALUES);
  const sales = parseTier(sp.sales, SALES_VALUES);
  const stability = parseTier(sp.stability, STAB_VALUES);

  const { rows, profitabilityMatrix, stabilitySegments, summary } = await fetchAnalytics();

  const hasSelection = profit !== null || sales !== null || stability !== null;
  const filteredRows = hasSelection
    ? rows.filter((r) => {
        if (profit && r.profit !== profit) return false;
        if (sales && r.sales !== sales) return false;
        if (stability && r.stability !== stability) return false;
        return true;
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Товарная аналитика"
        description="ABC×XYZ матрица, прибыльность и стабильность товаров"
      />
      <AnalyticsSummaryCards summary={summary} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProfitabilityMatrix
          cells={profitabilityMatrix}
          selectedProfit={profit}
          selectedSales={sales}
        />
        <StabilitySegments segments={stabilitySegments} selectedStability={stability} />
      </div>
      {hasSelection && (
        <div id="group">
          <AnalyticsGroupSection
            rows={filteredRows}
            profit={profit}
            sales={sales}
            stability={stability}
          />
        </div>
      )}
      <AnalyticsTable rows={rows} />
      <p className="text-xs text-muted-foreground">
        · Данные из `sku_catalog` + RPC `get_full_pnl_by_period` + `wb_reports_fact` (30 дней). ABC по накопленной выручке (80/15/5), XYZ по коэф. вариации дневных продаж.
      </p>
    </div>
  );
}
