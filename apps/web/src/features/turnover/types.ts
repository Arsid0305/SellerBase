import type { ProductTagKind } from '@/shared/ui/domain/product-tag-badge';

export type TurnoverSegmentKey = 'all' | 'stable' | 'medium' | 'unstable';

export type TurnoverSegment = {
  key: TurnoverSegmentKey;
  label: string;
  count: number;
  share: number; // 0..100
  salesUnits: number;
  salesRevenue: number;
  stockUnits: number;
  excessCount: number; // избыточных товаров
  outOfStockCount: number;
};

export type TurnoverDynamicsPoint = {
  date: string;
  stable: number;
  medium: number;
  unstable: number;
};

export type TurnoverProduct = {
  id: string;
  name: string;
  barcode: string;
  channel: 'WB' | 'OZON';
  tags: ProductTagKind[];
  segment: TurnoverSegmentKey;
  stockUnits: number;
  dailySales: number;
  daysOfStock: number; // сколько дней хватит
  revenue: number;
};
