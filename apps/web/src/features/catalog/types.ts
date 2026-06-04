import type { ProductTagKind } from '@/shared/ui/domain/product-tag-badge';
import type { ProductLifecycleState } from '@/entities/product-state';

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
  lifecycle: ProductLifecycleState;
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
