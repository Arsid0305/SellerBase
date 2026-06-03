import { Receipt } from 'lucide-react';
import { CategoryCard, StatList } from '@/shared/ui/domain/category-card';
import { formatRub } from '@/shared/lib/format';
import type { ProductDetail } from './types';

export function ProductExpensesCard({ product }: { product: ProductDetail }) {
  const e = product.expenses;
  return (
    <CategoryCard title="Расходы" tone="rose" icon={Receipt}>
      <StatList
        rows={[
          { label: 'Комиссия WB', value: formatRub(e.wbCommission) },
          { label: 'Логистика WB', value: formatRub(e.wbLogistics) },
          { label: 'Штрафы WB', value: formatRub(e.wbPenalties), tone: e.wbPenalties > 0 ? 'negative' : 'muted' },
          { label: 'Эквайринг', value: formatRub(e.acquiring) },
          { label: 'Хранение', value: formatRub(e.storage) },
          { label: 'Себестоимость товара', value: formatRub(e.cost), tone: 'muted' },
        ]}
      />
    </CategoryCard>
  );
}
