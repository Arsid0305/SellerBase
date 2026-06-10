import type { ProductTagKind } from '@/shared/ui/domain/product-tag-badge';
import type { ProductLifecycleState } from '@/entities/product-state/types';

export type CatalogStatus = 'in-stock' | 'out-of-stock' | 'no-sales' | 'excess';

export type CatalogProduct = {
  id: string;
  name: string;
  barcode: string;
  channel: 'WB' | 'OZON';
  brand: string;
  category: string;
  tags: ProductTagKind[];
  stock: number;
  inTransit: number;
  warehousesCount: number;
  sales30dRub: number;
  sales30dUnits: number;
  margin: number; // %
  cost: number;
  price: number;
  lastSaleDaysAgo: number;
  daysOfStock: number;
  salesSparkline: number[]; // 30 days, выручка
  visibility: number; // 0-100 — % дней с продажами в 30д
  trust: number; // 0-100 — стабильность продаж (1 - cv)
  value: number; // 0-100 — маржа × 2, clamped
  lifecycle?: ProductLifecycleState;
};

export type CatalogSummary = {
  totalCount: number;
  inStock: number;
  outOfStock: number;
  noSales30d: number;
  excessCount: number;
  totalSales30dRub: number;
  avgMargin: number;
};
