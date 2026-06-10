export type SkuWeeklyMetric = {
  id: number;
  sku_id: number | null;
  wb_article: number | null;
  barcode: string | null;
  year: number;
  week_num: number;
  stock_start: number | null;
  cost_per_unit: number | null;
  cost_stock_total: number | null;
  turnover_days: number | null;
  buyout_pct: number | null;
  sales_velocity: number | null;
  units_sold: number | null;
  units_returned: number | null;
  units_net: number | null;
  revenue_wb: number | null;
  cost_sold_total: number | null;
  commission_rub: number | null;
  commission_pct: number | null;
  logistics_rub: number | null;
  storage_rub: number | null;
  net_profit: number | null;
};

export type WeeklySummaryPoint = {
  week_num: number;
  units_sold: number;
  revenue: number;
  profit: number;
  margin_pct: number;
  turnover_days_avg: number;
};
