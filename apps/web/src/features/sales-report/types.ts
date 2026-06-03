export type SalesGrouping = 'day' | 'week' | 'month' | 'channel' | 'product';

export type SalesReportRow = {
  key: string;
  label: string;
  sublabel?: string;
  orders: number;
  unitsSold: number;
  revenue: number;
  avgCheck: number;
  cancellations: number;
  cancelRate: number; // 0..100
};

export type SalesSummary = {
  totalOrders: number;
  totalUnits: number;
  totalRevenue: number;
  avgCheck: number;
  cancellationRate: number;
};
