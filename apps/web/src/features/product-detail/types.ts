import type { ProductTagKind } from '@/shared/ui/domain/product-tag-badge';
import type { ProductLifecycleState } from '@/entities/product-state/types';

export type ProductDetailMeta = {
  brand: string;
  type: string;
  supplierCode: string;
  wbCode: string;
  barcode: string;
  inStock: boolean;
  inStockSince: string;
  rating?: number;
  reviewsCount?: number;
};

export type ProductDetailSales = {
  price: number;
  priceWithoutDiscount: number;
  orders: number;
  delivered: number;
  bought: number;
  returns: number;
  buyoutRate: number; // %
  daysSinceLastOrder: number;
  daysOfStock: number;
  turnoverDays: number;
};

export type ProductDetailFinance = {
  revenue: number;
  expenses: number;
  profit: number;
  profitability: number; // %
  marketingExpenses: number;
  revenueTrend: number; // % вс прошлый период
  lostRevenue: number;
};

export type ProductDetailExpenses = {
  wbCommission: number;
  wbLogistics: number;
  wbPenalties: number;
  acquiring: number;
  storage: number;
  cost: number;
};

export type WarehouseStock = {
  name: string;
  units: number;
  inTransit: number;
  daysOfStock: number;
};

export type ProductDetail = {
  id: string;
  name: string;
  channel: 'WB' | 'OZON';
  lifecycle: ProductLifecycleState;
  tags: ProductTagKind[];
  meta: ProductDetailMeta;
  sales: ProductDetailSales;
  finance: ProductDetailFinance;
  expenses: ProductDetailExpenses;
  warehouses: WarehouseStock[];
  revenueByDay: { date: string; revenue: number; orders: number }[];
  stockByDay: { date: string; stock: number; inTransit: number }[];
};
