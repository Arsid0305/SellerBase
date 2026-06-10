CREATE TABLE IF NOT EXISTS sku_weekly_metrics (
  id BIGSERIAL PRIMARY KEY,
  sku_id BIGINT REFERENCES sku_catalog(id) ON DELETE CASCADE,
  wb_article BIGINT,
  barcode TEXT,
  year INT NOT NULL,
  week_num INT NOT NULL CHECK (week_num BETWEEN 1 AND 53),
  stock_start INT,
  cost_per_unit NUMERIC(10,2),
  cost_stock_total NUMERIC(12,2),
  turnover_days NUMERIC(8,2),
  buyout_pct NUMERIC(5,2),
  sales_velocity NUMERIC(6,3),
  units_sold INT,
  units_returned INT,
  units_net INT,
  revenue_wb NUMERIC(12,2),
  cost_sold_total NUMERIC(12,2),
  commission_rub NUMERIC(10,2),
  commission_pct NUMERIC(5,2),
  logistics_rub NUMERIC(10,2),
  storage_rub NUMERIC(10,2),
  net_profit NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sku_id, year, week_num)
);
CREATE INDEX IF NOT EXISTS sku_weekly_metrics_sku_idx ON sku_weekly_metrics(sku_id);
CREATE INDEX IF NOT EXISTS sku_weekly_metrics_week_idx ON sku_weekly_metrics(year, week_num);
ALTER TABLE sku_weekly_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON sku_weekly_metrics;
CREATE POLICY "service_role_all" ON sku_weekly_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);
