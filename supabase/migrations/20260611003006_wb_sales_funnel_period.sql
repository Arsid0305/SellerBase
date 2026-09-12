-- Aggregated WB sales funnel per nm_id for a rolling 60-day period.
-- Source: POST /api/analytics/v3/sales-funnel/products (single call covers full period).
CREATE TABLE IF NOT EXISTS wb_sales_funnel_period (
  nm_id BIGINT PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  open_count INTEGER DEFAULT 0,
  cart_count INTEGER DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  order_sum NUMERIC(14,2) DEFAULT 0,
  buyout_count INTEGER DEFAULT 0,
  buyout_sum NUMERIC(14,2) DEFAULT 0,
  cancel_count INTEGER DEFAULT 0,
  buyout_percent INTEGER,
  add_to_cart_percent INTEGER,
  cart_to_order_percent INTEGER,
  avg_price NUMERIC(12,2),
  avg_orders_per_day NUMERIC(8,2),
  share_order_percent NUMERIC(6,2),
  localization_percent NUMERIC(6,2),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE wb_sales_funnel_period ENABLE ROW LEVEL SECURITY;
CREATE POLICY wb_sales_funnel_period_select_auth ON wb_sales_funnel_period FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE VIEW v_buyout_pct_period
WITH (security_invoker = on)
AS
SELECT
  MIN(period_start) AS period_start,
  MAX(period_end) AS period_end,
  COUNT(*) AS sku_count,
  SUM(open_count) AS opens,
  SUM(cart_count) AS cart,
  SUM(order_count) AS orders,
  SUM(buyout_count) AS buyouts,
  ROUND((SUM(buyout_count)*100.0 / NULLIF(SUM(order_count),0))::numeric, 2) AS buyout_pct,
  ROUND((SUM(cart_count)*100.0 / NULLIF(SUM(open_count),0))::numeric, 2) AS cr1_pct,
  ROUND((SUM(order_count)*100.0 / NULLIF(SUM(cart_count),0))::numeric, 2) AS cr2_pct
FROM wb_sales_funnel_period;

-- Cron daily 04:00 UTC — refresh last 60 days
SELECT cron.schedule(
  'fetch-wb-funnel-aggregate-daily',
  '0 4 * * *',
  $$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-funnel-aggregate',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$$
);
