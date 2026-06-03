export type SupplyRecommendationRowDb = {
  sku_id: number;
  my_article: string | null;
  wb_article: number | null;
  barcode: string | null;
  units_per_day: number;
  total_stock: number;
  lead_time_days: number;
  safety_stock_days: number;
  units_to_order: number;
};

export type SkuCatalogRowDb = {
  id: number;
  title: string | null;
  category: string | null;
  brand: string | null;
  cost_price_rub: number | null;
};
