import type { ProductTagKind } from '@/shared/ui/domain/product-tag-badge';

export type ProfitTier = 'PPP' | 'PP' | 'P' | '-P';
export type SalesTier = 'A' | 'B' | 'C';
export type StabilityTier = 'X' | 'Y' | 'Z';

export type ProfitabilityCell = {
  profit: ProfitTier;
  sales: SalesTier;
  count: number;
};

export type StabilitySegment = {
  tier: StabilityTier;
  label: string;
  count: number;
  share: number;
  description: string;
};

export type AnalyticsRow = {
  id: string;
  name: string;
  barcode: string;
  channel: 'WB' | 'OZON';
  tags: ProductTagKind[];
  profit: ProfitTier;
  sales: SalesTier;
  stability: StabilityTier;
  revenue: number;
  margin: number; // %
  cost: number;
  stock: number;
  unitsSold: number;
};

export type AnalyticsSummary = {
  totalProducts: number;
  withCost: number;
  withoutCost: number;
  withSales: number;
  stable: number;
  unstable: number;
};
