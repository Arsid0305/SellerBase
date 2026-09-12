CREATE OR REPLACE VIEW v_buyout_pct_by_sku
WITH (security_invoker = on)
AS
SELECT
  p.nm_id,
  s.my_article,
  s.title,
  p.period_start, p.period_end,
  p.open_count, p.cart_count, p.order_count, p.buyout_count,
  p.buyout_percent AS buyout_pct,
  p.add_to_cart_percent AS cr1_pct,
  p.cart_to_order_percent AS cr2_pct,
  p.avg_orders_per_day,
  p.avg_price,
  ROUND((p.buyout_sum)::numeric, 0) AS buyout_sum
FROM wb_sales_funnel_period p
LEFT JOIN sku_catalog s ON s.wb_article = p.nm_id;

CREATE OR REPLACE VIEW v_logistics_actual_per_unit_60d
WITH (security_invoker = on)
AS
WITH sold AS (
  SELECT SUM(quantity) AS sold_units
  FROM wb_reports_fact
  WHERE rr_dt >= CURRENT_DATE - INTERVAL '60 days'
    AND doc_type_name = 'Продажа'
),
log AS (
  SELECT SUM(delivery_rub) AS logistics_rub
  FROM wb_reports_fact
  WHERE rr_dt >= CURRENT_DATE - INTERVAL '60 days'
    AND delivery_rub > 0
)
SELECT
  (SELECT sold_units FROM sold) AS sold_units,
  (SELECT ROUND(logistics_rub::numeric, 2) FROM log) AS logistics_rub_total,
  CASE WHEN (SELECT sold_units FROM sold) > 0
    THEN ROUND(((SELECT logistics_rub FROM log) / (SELECT sold_units FROM sold))::numeric, 2)
    ELSE NULL
  END AS avg_logistics_per_sold_unit;
