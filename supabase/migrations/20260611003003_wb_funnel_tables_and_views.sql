-- Tables for WB sales funnel, goods returns, turnover daily
CREATE TABLE IF NOT EXISTS wb_sales_funnel (
  nm_id BIGINT NOT NULL,
  dt DATE NOT NULL,
  open_count INTEGER DEFAULT 0,
  add_to_cart_count INTEGER DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  order_sum NUMERIC(14,2) DEFAULT 0,
  buyout_count INTEGER DEFAULT 0,
  buyout_sum NUMERIC(14,2) DEFAULT 0,
  cancel_count INTEGER DEFAULT 0,
  cancel_sum NUMERIC(14,2) DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (nm_id, dt)
);
CREATE INDEX IF NOT EXISTS wb_sales_funnel_dt_idx ON wb_sales_funnel (dt);

CREATE TABLE IF NOT EXISTS wb_goods_returns (
  nm_id BIGINT NOT NULL,
  dt DATE NOT NULL,
  return_count INTEGER DEFAULT 0,
  return_sum NUMERIC(14,2) DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (nm_id, dt)
);
CREATE INDEX IF NOT EXISTS wb_goods_returns_dt_idx ON wb_goods_returns (dt);

CREATE TABLE IF NOT EXISTS wb_turnover_daily (
  nm_id BIGINT NOT NULL,
  dt DATE NOT NULL,
  turnover_days NUMERIC(8,2),
  stock_qty INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (nm_id, dt)
);
CREATE INDEX IF NOT EXISTS wb_turnover_daily_dt_idx ON wb_turnover_daily (dt);

ALTER TABLE wb_sales_funnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE wb_goods_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE wb_turnover_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY wb_sales_funnel_select_auth ON wb_sales_funnel FOR SELECT TO authenticated USING (true);
CREATE POLICY wb_goods_returns_select_auth ON wb_goods_returns FOR SELECT TO authenticated USING (true);
CREATE POLICY wb_turnover_daily_select_auth ON wb_turnover_daily FOR SELECT TO authenticated USING (true);

-- Views: agregaty за 28/60d по SKU + общий для дашборда
CREATE OR REPLACE VIEW v_sku_funnel_28d
WITH (security_invoker = on)
AS
SELECT
  nm_id,
  SUM(open_count) AS opens,
  SUM(add_to_cart_count) AS cart,
  SUM(order_count) AS orders,
  SUM(order_sum) AS orders_sum,
  SUM(buyout_count) AS buyouts,
  SUM(buyout_sum) AS buyouts_sum,
  SUM(cancel_count) AS cancels,
  ROUND((SUM(buyout_count)*100.0 / NULLIF(SUM(order_count),0))::numeric, 2) AS buyout_pct,
  ROUND((SUM(add_to_cart_count)*100.0 / NULLIF(SUM(open_count),0))::numeric, 2) AS cr1_open_to_cart_pct,
  ROUND((SUM(order_count)*100.0 / NULLIF(SUM(add_to_cart_count),0))::numeric, 2) AS cr2_cart_to_order_pct,
  ROUND((SUM(buyout_count)*100.0 / NULLIF(SUM(open_count),0))::numeric, 2) AS cr_total_pct
FROM wb_sales_funnel
WHERE dt >= CURRENT_DATE - INTERVAL '28 days'
GROUP BY nm_id;

CREATE OR REPLACE VIEW v_sku_funnel_60d
WITH (security_invoker = on)
AS
SELECT
  nm_id,
  SUM(open_count) AS opens,
  SUM(add_to_cart_count) AS cart,
  SUM(order_count) AS orders,
  SUM(buyout_count) AS buyouts,
  ROUND((SUM(buyout_count)*100.0 / NULLIF(SUM(order_count),0))::numeric, 2) AS buyout_pct,
  ROUND((SUM(buyout_count)*100.0 / NULLIF(SUM(open_count),0))::numeric, 2) AS cr_total_pct
FROM wb_sales_funnel
WHERE dt >= CURRENT_DATE - INTERVAL '60 days'
GROUP BY nm_id;

CREATE OR REPLACE VIEW v_buyout_pct_total
WITH (security_invoker = on)
AS
SELECT
  '28d'::text AS period,
  SUM(open_count) AS opens,
  SUM(add_to_cart_count) AS cart,
  SUM(order_count) AS orders,
  SUM(buyout_count) AS buyouts,
  ROUND((SUM(buyout_count)*100.0 / NULLIF(SUM(order_count),0))::numeric, 2) AS buyout_pct,
  ROUND((SUM(add_to_cart_count)*100.0 / NULLIF(SUM(open_count),0))::numeric, 2) AS cr1_pct,
  ROUND((SUM(order_count)*100.0 / NULLIF(SUM(add_to_cart_count),0))::numeric, 2) AS cr2_pct
FROM wb_sales_funnel
WHERE dt >= CURRENT_DATE - INTERVAL '28 days'
UNION ALL
SELECT
  '60d', SUM(open_count), SUM(add_to_cart_count), SUM(order_count), SUM(buyout_count),
  ROUND((SUM(buyout_count)*100.0 / NULLIF(SUM(order_count),0))::numeric, 2),
  ROUND((SUM(add_to_cart_count)*100.0 / NULLIF(SUM(open_count),0))::numeric, 2),
  ROUND((SUM(order_count)*100.0 / NULLIF(SUM(add_to_cart_count),0))::numeric, 2)
FROM wb_sales_funnel
WHERE dt >= CURRENT_DATE - INTERVAL '60 days'
UNION ALL
SELECT
  '90d', SUM(open_count), SUM(add_to_cart_count), SUM(order_count), SUM(buyout_count),
  ROUND((SUM(buyout_count)*100.0 / NULLIF(SUM(order_count),0))::numeric, 2),
  ROUND((SUM(add_to_cart_count)*100.0 / NULLIF(SUM(open_count),0))::numeric, 2),
  ROUND((SUM(order_count)*100.0 / NULLIF(SUM(add_to_cart_count),0))::numeric, 2)
FROM wb_sales_funnel
WHERE dt >= CURRENT_DATE - INTERVAL '90 days';
