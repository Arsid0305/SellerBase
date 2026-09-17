import { PageHeader } from '@/widgets/app-shell/page-header';
import { TurnoverExplorer, TurnoverTabs } from '@/features/turnover';
import { fetchTurnoverData } from '@/entities/turnover';
import { DeficitSummaryCards, DeficitTable } from '@/features/deficit';
import { fetchSupplyRecommendation, buildDeficitSummary, filterRealDeficit } from '@/entities/supply';

export const metadata = { title: 'Оборачиваемость' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TurnoverPage() {
  // Дефицит живёт здесь же: это тот же разговор про запас, только с другой
  // стороны. Решение владелицы 17.09.2026 - отдельным пунктом меню не держим.
  const [{ segments, products }, allRows] = await Promise.all([
    fetchTurnoverData(),
    fetchSupplyRecommendation(),
  ]);
  const realDeficit = filterRealDeficit(allRows);
  const deficitSummary = buildDeficitSummary(allRows);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Оборачиваемость"
        description="Надолго ли хватит запаса и что заканчивается"
      />

      <TurnoverTabs
        deficitCount={realDeficit.length}
        turnover={
          <div className="flex flex-col gap-6">
            <TurnoverExplorer segments={segments} products={products} />
            <p className="text-xs text-muted-foreground">
              · Сегменты по «хватит на дней»: стабильная 30-90 д., средняя 7-30 или 90-180 д.,
              нестабильная - остальное. Продажи берутся за 30 дней.
            </p>
          </div>
        }
        deficit={
          <div className="flex flex-col gap-6">
            <DeficitSummaryCards summary={deficitSummary} />
            <DeficitTable rows={realDeficit} />
            <p className="text-xs text-muted-foreground">
              · Показаны только товары, которым реально нужна поставка: запаса меньше чем на
              14 дней или он кончился. Упущенная выручка считается по средней цене продажи за
              90 дней.
            </p>
          </div>
        }
      />
    </div>
  );
}
