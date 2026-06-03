import type { ProductTagKind } from '@/shared/ui/domain/product-tag-badge';

export type DeficitRow = {
  id: string;
  name: string;
  barcode: string;
  channel: 'WB' | 'OZON';
  warehouse: string;
  tags: ProductTagKind[];
  lostRevenue: number; // ₽, упущено
  forecastDemand: number; // ₽, прогноз спроса
  daysLeft: number; // сколько дней хватит
  toSupply: number; // шт, к поставке
  dailySales: number; // ср. продаж в день, шт
  stock: number; // остаток, шт
};

export type DeficitSummary = {
  totalLostRevenue: number;
  outOfStockCount: number;
  criticalCount: number; // хватит < 3 дней
  warningCount: number; // 3..7 дней
  totalRows: number;
};
