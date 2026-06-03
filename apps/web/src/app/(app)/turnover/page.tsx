import { PageHeader } from '@/widgets/app-shell/page-header';
import { TurnoverExplorer } from '@/features/turnover';
import { fetchTurnoverData } from '@/entities/turnover';

export const metadata = { title: 'Оборачиваемость' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TurnoverPage() {
  const { segments, products } = await fetchTurnoverData();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Оборачиваемость"
        description="Сегменты по «деньгам в товаре» — стабильные, средние и нестабильные"
      />
      <TurnoverExplorer segments={segments} products={products} />
      <p className="text-xs text-muted-foreground">
        · Данные из `v_turnover` + `sku_catalog` + `wb_reports_fact` (30 дней продаж). Классификация по «хватит на дней»: стабильная 30–90 д., средняя 7–30 или 90–180 д., нестабильная — остальное.
      </p>
    </div>
  );
}
