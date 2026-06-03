import { Banknote } from 'lucide-react';
import { CategoryCard, StatList } from '@/shared/ui/domain/category-card';
import { formatRub, formatDelta } from '@/shared/lib/format';
import type { ProductDetail } from './types';

export function ProductFinanceCard({ product }: { product: ProductDetail }) {
  const f = product.finance;
  return (
    <CategoryCard title="Финансы" tone="emerald" icon={Banknote}>
      <StatList
        rows={[
          { label: 'Выручка', value: formatRub(f.revenue) },
          { label: 'Расходы', value: formatRub(f.expenses), tone: 'negative' },
          { label: 'Прибыль', value: formatRub(f.profit), tone: 'positive' },
          { label: 'Рентабельность', value: `${f.profitability.toFixed(1)}%`, tone: 'positive' },
          { label: 'Расходы на маркетинг', value: formatRub(f.marketingExpenses), tone: 'muted' },
          {
            label: 'Тренд выручки',
            value: formatDelta(f.revenueTrend),
            tone: f.revenueTrend < 0 ? 'negative' : 'positive',
          },
          { label: 'Упущенная выручка', value: formatRub(f.lostRevenue), tone: 'negative' },
        ]}
      />
    </CategoryCard>
  );
}
