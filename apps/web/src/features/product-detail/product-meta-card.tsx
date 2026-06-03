import { Package } from 'lucide-react';
import { CategoryCard, StatList } from '@/shared/ui/domain/category-card';
import type { ProductDetail } from './types';

export function ProductMetaCard({ product }: { product: ProductDetail }) {
  return (
    <CategoryCard title="Товар" tone="amber" icon={Package}>
      <StatList
        rows={[
          { label: 'Бренд', value: product.meta.brand },
          { label: 'Тип товара', value: product.meta.type, tone: 'muted' },
          { label: 'Поставщик', value: product.meta.supplierCode, tone: 'muted' },
          { label: 'Код WB', value: product.meta.wbCode },
          { label: 'Штрихкод', value: <span className="font-mono text-xs">{product.meta.barcode}</span> },
          { label: 'Рейтинг', value: `${product.meta.rating?.toFixed(1) ?? '—'} ★` },
          { label: 'Отзывы', value: `${product.meta.reviewsCount?.toLocaleString('ru-RU') ?? 0}` },
          { label: 'В стоке с', value: product.meta.inStockSince, tone: 'muted' },
        ]}
      />
    </CategoryCard>
  );
}
