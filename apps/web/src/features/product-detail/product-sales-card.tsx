import { ShoppingCart } from 'lucide-react';
import { CategoryCard, StatList } from '@/shared/ui/domain/category-card';
import { formatRub, formatInt } from '@/shared/lib/format';
import type { ProductDetail } from './types';

export function ProductSalesCard({ product }: { product: ProductDetail }) {
  const s = product.sales;
  const noSalesLong = s.daysSinceLastOrder > 30;
  return (
    <CategoryCard title="Продажи" tone="rose" icon={ShoppingCart}>
      <StatList
        rows={[
          { label: 'Цена продажи', value: formatRub(s.price) },
          { label: 'Цена без скидки', value: formatRub(s.priceWithoutDiscount), tone: 'muted' },
          { label: 'Заказы', value: `${formatInt(s.orders)} шт.` },
          { label: 'Доставлено', value: `${formatInt(s.delivered)} шт.` },
          { label: 'Выкуплено', value: `${formatInt(s.bought)} шт.` },
          { label: 'Возвраты', value: `${formatInt(s.returns)} шт.`, tone: s.returns > 0 ? 'negative' : 'muted' },
          {
            label: 'Процент выкупа',
            value: `${s.buyoutRate.toFixed(1)}%`,
            tone: s.buyoutRate < 60 ? 'negative' : 'positive',
            hint: '(заказы − возвраты) / заказы × 100%',
          },
          {
            label: 'Дней с последнего заказа',
            value: s.daysSinceLastOrder === 0 ? 'сегодня' : `${s.daysSinceLastOrder} д.`,
            tone: noSalesLong ? 'negative' : undefined,
          },
          {
            label: 'Дней на остатке',
            value: `${s.daysOfStock} д.`,
            tone: s.daysOfStock === 0 ? 'negative' : undefined,
            hint: 'Остаток / средние продажи в день за 30д',
          },
          { label: 'Оборачиваемость', value: `${s.turnoverDays} д.`, tone: 'muted' },
        ]}
      />
    </CategoryCard>
  );
}
