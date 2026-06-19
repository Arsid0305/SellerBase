-- wb_orders_fact — заказы из Statistics API /api/v1/supplier/orders.
-- Аналог wb_sales_fact, но по заказам (включая отменённые, is_cancel=true).
-- Используется для свежих KPI «Заказы» на дашборде (вкладка WbStyleChart).

CREATE TABLE IF NOT EXISTS wb_orders_fact (
  g_number          TEXT NOT NULL,
  date              TIMESTAMPTZ NOT NULL,
  last_change_date  TIMESTAMPTZ NOT NULL,
  warehouse_name    TEXT,
  nm_id             BIGINT,
  subject           TEXT,
  category          TEXT,
  brand             TEXT,
  tech_size         TEXT,
  barcode           TEXT,
  total_price       NUMERIC(14,2),
  discount_percent  INTEGER,
  spp               NUMERIC(5,2),
  price_with_disc   NUMERIC(14,2),
  finished_price    NUMERIC(14,2),
  for_pay           NUMERIC(14,2),
  oblast            TEXT,
  country_name      TEXT,
  income_id         BIGINT,
  number            TEXT,
  is_supply         BOOLEAN,
  is_realization    BOOLEAN,
  is_cancel         BOOLEAN NOT NULL DEFAULT false,
  cancel_dt         TIMESTAMPTZ,
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (g_number, date)
);

CREATE INDEX IF NOT EXISTS ix_wb_orders_fact_date ON wb_orders_fact(date);
CREATE INDEX IF NOT EXISTS ix_wb_orders_fact_nm ON wb_orders_fact(nm_id);
CREATE INDEX IF NOT EXISTS ix_wb_orders_fact_last_change ON wb_orders_fact(last_change_date);

COMMENT ON TABLE wb_orders_fact IS
'Заказы с Statistics API /orders. По одной строке на (g_number, date). is_cancel=true → заказ отменён.';

ALTER TABLE wb_orders_fact ENABLE ROW LEVEL SECURITY;
-- Без policies = доступ только через service_role (admin client / edge functions), как у wb_sales_fact.

-- View агрегации по дням заказов (для дашборда «вчера/сегодня»)
CREATE OR REPLACE VIEW v_daily_orders
WITH (security_invoker = true)
AS
SELECT
  (date AT TIME ZONE 'Europe/Moscow')::date AS order_dt,
  COUNT(*) FILTER (WHERE NOT is_cancel) AS orders_count,
  COUNT(*) FILTER (WHERE is_cancel) AS cancelled_count,
  SUM(price_with_disc) FILTER (WHERE NOT is_cancel) AS revenue_rub
FROM wb_orders_fact
GROUP BY (date AT TIME ZONE 'Europe/Moscow')::date
ORDER BY order_dt DESC;

COMMENT ON VIEW v_daily_orders IS
'Дневной агрегат wb_orders_fact: заказано/отменено штук и сумма заказов (price_with_disc, без SPP) в МСК.';

-- Почасовая агрегация заказов (аналог get_sales_hourly) для WB-style графика.
CREATE OR REPLACE FUNCTION public.get_orders_hourly(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(
  hour timestamptz,
  count integer,
  sum_rub numeric
)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT
    date_trunc('hour', date) AS hour,
    count(*)::integer AS count,
    sum(COALESCE(price_with_disc, 0)) AS sum_rub
  FROM public.wb_orders_fact
  WHERE date >= p_from AND date < p_to AND COALESCE(is_cancel, false) = false
  GROUP BY date_trunc('hour', date)
  ORDER BY hour;
$function$;
