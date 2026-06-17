import { Scale } from 'lucide-react';
import { CategoryCard, StatList } from '@/shared/ui/domain/category-card';
import { formatRub } from '@/shared/lib/format';
import type { ProductDetail } from './types';

const ACQUIRING_PCT = 0.015;
const TAX_PCT = 0.06;

export function BreakEvenCard({ product }: { product: ProductDetail }) {
  const unitsSold = product.sales.delivered;
  const revenue = product.finance.revenue;
  const currentPrice = product.sales.price;

  const costPerUnit = unitsSold > 0 ? product.expenses.cost / unitsSold : 0;
  const logisticsPerUnit = unitsSold > 0 ? product.expenses.wbLogistics / unitsSold : 0;
  const storagePerUnit = unitsSold > 0 ? product.expenses.storage / unitsSold : 0;
  const commissionPct = revenue > 0 ? product.expenses.wbCommission / revenue : 0;
  const returnsPct = (100 - product.sales.buyoutRate) / 100;

  const fixedPerUnit = costPerUnit + logisticsPerUnit + storagePerUnit;
  const variableShare = commissionPct + ACQUIRING_PCT + TAX_PCT + returnsPct;
  const denom = 1 - variableShare;

  const hasData = unitsSold > 0 && revenue > 0 && denom > 0;
  const breakEven = hasData ? fixedPerUnit / denom : 0;
  const margin = hasData && currentPrice > 0 ? ((currentPrice - breakEven) / currentPrice) * 100 : 0;

  return (
    <CategoryCard title="Точка безубыточности" tone="amber" icon={Scale}>
      {!hasData ? (
        <p className="text-sm text-muted-foreground">
          Нет данных для расчёта (нужны: продажи 30д, себестоимость, цена).
        </p>
      ) : (
        <StatList
          rows={[
            {
              label: 'Минимальная цена',
              value: formatRub(breakEven),
              tone: breakEven < currentPrice ? 'positive' : 'negative',
              hint: 'Цена при которой маржа = 0% с учётом всех расходов',
            },
            {
              label: 'Запас прочности',
              value: `${margin.toFixed(1)}%`,
              tone: breakEven < currentPrice ? 'positive' : 'negative',
            },
            { label: 'Себестоимость на ед.', value: formatRub(costPerUnit), tone: 'muted' },
            { label: 'Логистика на ед.', value: formatRub(logisticsPerUnit), tone: 'muted' },
            {
              label: 'Хранение на ед.',
              value: formatRub(storagePerUnit),
              tone: 'muted',
              hint: storagePerUnit === 0 ? 'Не учтено — данные отсутствуют' : undefined,
            },
            { label: 'Комиссия WB', value: `${(commissionPct * 100).toFixed(1)}%`, tone: 'muted' },
            { label: 'Эквайринг', value: '1.5%', tone: 'muted' },
            { label: 'Налог УСН', value: '6%', tone: 'muted' },
            {
              label: 'Возвраты',
              value: `${(returnsPct * 100).toFixed(1)}%`,
              tone: returnsPct > 0.1 ? 'negative' : 'muted',
            },
          ]}
        />
      )}
    </CategoryCard>
  );
}
