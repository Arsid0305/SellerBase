-- Оборачиваемость SKU — расчёт в view из wb_stocks × wb_sales_funnel.
-- Семантика: turnover_days = дни до распродажи стока. Больше — хуже. Границы 60/90.
CREATE OR REPLACE VIEW v_turnover_by_sku
WITH (security_invoker = on)
AS
WITH stock_cur AS (
  SELECT nm_id, SUM(quantity) AS stock_qty
  FROM wb_stocks
  GROUP BY nm_id
),
orders_avg AS (
  SELECT
    nm_id,
    AVG(order_count) AS avg_orders_per_day_28d
  FROM wb_sales_funnel
  WHERE dt >= CURRENT_DATE - INTERVAL '28 days'
  GROUP BY nm_id
)
SELECT
  COALESCE(s.nm_id, o.nm_id) AS nm_id,
  COALESCE(s.stock_qty, 0) AS stock_qty,
  ROUND(COALESCE(o.avg_orders_per_day_28d, 0)::numeric, 2) AS avg_orders_per_day_28d,
  CASE
    WHEN COALESCE(o.avg_orders_per_day_28d, 0) > 0 AND COALESCE(s.stock_qty, 0) > 0
      THEN ROUND((s.stock_qty / o.avg_orders_per_day_28d)::numeric, 1)
    ELSE NULL
  END AS turnover_days,
  CASE
    WHEN COALESCE(o.avg_orders_per_day_28d, 0) = 0 AND COALESCE(s.stock_qty, 0) > 0 THEN 'нет продаж — критично'
    WHEN COALESCE(s.stock_qty, 0) = 0 THEN 'нет стока'
    WHEN (s.stock_qty / o.avg_orders_per_day_28d) < 60 THEN 'норма'
    WHEN (s.stock_qty / o.avg_orders_per_day_28d) BETWEEN 60 AND 90 THEN 'акция полезна'
    ELSE 'срочно сливать'
  END AS recommendation
FROM stock_cur s
FULL OUTER JOIN orders_avg o ON s.nm_id = o.nm_id;
