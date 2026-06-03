/**
 * Типы P&L по реальным ДБ-схемам.
 * Отражают вывод RPC get_full_pnl_by_period.
 */

export type PnlSkuRow = {
  sku_id: number;
  my_article: string | null;
  wb_article: number | null;
  barcode: string | null;
  revenue_rub: number;
  commission_rub: number;
  logistics_rub: number;
  units_sold: number;
  cogs_rub: number;
  marketing_rub: number;
  tax_rub: number;
  net_profit_rub: number;
  margin_pct: number;
};

export type PnlAggregate = {
  revenue: number;
  mainExpenses: number; // commission + logistics + cogs
  extraExpenses: number; // marketing + tax
  profit: number;
  unitsSold: number;
  marginPct: number;
};

export type DailyRevenuePoint = {
  date: string; // yyyy-mm-dd
  revenue: number;
  expenses: number;
};

export type PeriodRange = { from: string; to: string }; // ISO yyyy-mm-dd inclusive
