import { PageHeader } from '@/widgets/app-shell/page-header';
import { DeficitSummaryCards, DeficitTable } from '@/features/deficit';
import { fetchSupplyRecommendation, buildDeficitSummary } from '@/entities/supply';

export const metadata = { title: 'Дефицит товаров' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DeficitPage() {
  const rows = await fetchSupplyRecommendation();
  const summary = buildDeficitSummary(rows);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Дефицит товаров"
        description="Что заканчивается и сколько денег теряется на упущенных продажах"
      />
      <DeficitSummaryCards summary={summary} />
      <DeficitTable rows={rows} />
      <p className="text-xs text-muted-foreground">
        · Данные из view `v_supply_recommendation` + `sku_catalog`. Цена реализации и упущенная выручка — среднее за 90 дней из `wb_reports_fact`.
      </p>
    </div>
  );
}
