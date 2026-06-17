import { Warehouse } from 'lucide-react';
import { CategoryCard } from '@/shared/ui/domain/category-card';
import { formatInt } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { ProductDetail } from './types';

export function ProductWarehousesCard({ product }: { product: ProductDetail }) {
  const total = product.warehouses.reduce((acc, w) => acc + w.units, 0);
  const inTransitTotal = product.warehouses.reduce((acc, w) => acc + w.inTransit, 0);

  if (product.warehouses.length === 0) {
    return (
      <CategoryCard title="Склады" tone="sky" icon={Warehouse}>
        <p className="text-sm text-muted-foreground">Нет данных по остаткам на складах.</p>
      </CategoryCard>
    );
  }

  return (
    <CategoryCard title="Склады" tone="sky" icon={Warehouse}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3 text-sm">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">На складах</span>
            <span
              className={cn(
                'text-lg font-semibold tabular-nums',
                total === 0 && 'text-rose-600 dark:text-rose-400',
              )}
            >
              {formatInt(total)} шт.
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">В пути</span>
            <span className="text-lg font-semibold tabular-nums text-muted-foreground">{formatInt(inTransitTotal)} шт.</span>
          </div>
        </div>
        <ul className="flex flex-col divide-y divide-border">
          {product.warehouses.map((w) => (
            <li key={w.name} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="flex flex-col">
                <span className="font-medium leading-tight">{w.name}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  в пути: {formatInt(w.inTransit)} шт. · хватит на {w.daysOfStock} д.
                </span>
              </div>
              <span
                className={cn(
                  'tabular-nums font-medium',
                  w.units === 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground',
                )}
              >
                {formatInt(w.units)} шт.
              </span>
            </li>
          ))}
        </ul>
      </div>
    </CategoryCard>
  );
}
