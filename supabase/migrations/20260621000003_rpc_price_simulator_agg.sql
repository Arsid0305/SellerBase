-- Замена .range(0, 200_000) в apps/web/src/entities/price-simulator/queries.ts
-- (до 200k строк wb_reports_fact → одна строка на nm_id).

CREATE OR REPLACE FUNCTION public.get_price_simulator_agg(p_since date)
RETURNS TABLE(
  nm_id          integer,
  price_sum      numeric,
  price_count    integer,
  commission_rub numeric,
  delivery_rub   numeric,
  storage_rub    numeric,
  acquiring_rub  numeric,
  units_sold     numeric,
  returns_count  numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT
    nm_id,
    SUM(CASE WHEN quantity > 0 AND retail_price IS NOT NULL THEN retail_price ELSE 0 END)::numeric,
    SUM(CASE WHEN quantity > 0 AND retail_price IS NOT NULL THEN 1 ELSE 0 END)::int,
    COALESCE(SUM(commission_rub), 0)::numeric,
    COALESCE(SUM(delivery_rub), 0)::numeric,
    COALESCE(SUM(storage_fee), 0)::numeric,
    COALESCE(SUM(acquiring_fee), 0)::numeric,
    COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0)::numeric,
    COALESCE(SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END), 0)::numeric
  FROM public.wb_reports_fact
  WHERE rr_dt >= p_since AND nm_id IS NOT NULL
  GROUP BY nm_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_price_simulator_agg(date) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_price_simulator_agg(date) IS
'Агрегат wb_reports_fact по nm_id для price-simulator: priceSum/Count, commission/delivery/storage/acquiring, unitsSold, returnsCount. Замена .range(200_000) в price-simulator/queries.ts.';
