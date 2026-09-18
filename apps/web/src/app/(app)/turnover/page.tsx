import { PageHeader } from '@/widgets/app-shell/page-header';
import { TurnoverExplorer, TurnoverTabs } from '@/features/turnover';
import { fetchTurnoverData } from '@/entities/turnover';
import { DeficitSummaryCards, DeficitTable } from '@/features/deficit';
import { fetchSupplyRecommendation, buildDeficitSummary, filterRealDeficit } from '@/entities/supply';
import { StockMoneyTable } from '@/features/stock-money';
import { fetchStockMoney } from '@/entities/stock-money';
import { FbsAlert, StockByArticleTable } from '@/features/stock-by-article';
import { fetchFbsMismatch, fetchStockByArticle } from '@/entities/stock-by-article';

export const metadata = { title: 'Остатки и оборачиваемость' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TurnoverPage() {
  // Дефицит живёт здесь же: это тот же разговор про запас, только с другой
  // стороны. Решение владелицы 17.09.2026 - отдельным пунктом меню не держим.
  const [{ segments, products }, allRows, stockMoney, byArticle, fbsMismatch] = await Promise.all([
    fetchTurnoverData(),
    fetchSupplyRecommendation(),
    fetchStockMoney(),
    fetchStockByArticle(),
    fetchFbsMismatch(),
  ]);
  const realDeficit = filterRealDeficit(allRows);
  const deficitSummary = buildDeficitSummary(allRows);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Остатки и оборачиваемость"
        description="Что где лежит, надолго ли хватит и что заканчивается"
      />

      {/*
        Рассинхрон ФБС - отдельной строкой над всем остальным, а не колонкой
        в широкой таблице: такое надо увидеть, а не найти. Когда площадки
        согласны, строки нет совсем.
      */}
      <FbsAlert rows={fbsMismatch} />

      {/*
        Деньги в остатках - над вкладками, а не внутри: просьба владелицы
        17.09.2026 видеть эту сводку сразу, без переключений. До этого
        мёртвые деньги не были видны в программе нигде.
      */}
      <StockMoneyTable rows={stockMoney} />

      <TurnoverTabs
        deficitCount={realDeficit.length}
        stock={<StockByArticleTable rows={byArticle} />}
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
