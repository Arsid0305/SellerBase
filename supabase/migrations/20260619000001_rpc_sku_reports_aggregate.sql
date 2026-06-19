-- Агрегация wb_reports_fact по nm_id за период.
-- Заменяет паттерн `.range(0, 200_000)` в data-quality (вытягивание сырых строк в RSC).
CREATE OR REPLACE FUNCTION public.get_sku_reports_aggregate(p_from date, p_to date)
RETURNS TABLE (
  nm_id bigint,
  units_sold bigint,
  units_returned bigint,
  revenue_rub numeric,
  last_sale_dt date
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT
    f.nm_id,
    COALESCE(SUM(CASE WHEN f.quantity > 0 THEN f.quantity ELSE 0 END), 0)::bigint AS units_sold,
    COALESCE(SUM(CASE WHEN f.quantity < 0 THEN -f.quantity ELSE 0 END), 0)::bigint AS units_returned,
    COALESCE(SUM(CASE WHEN f.quantity > 0 THEN f.retail_amount ELSE -f.retail_amount END), 0)::numeric AS revenue_rub,
    MAX(CASE WHEN f.quantity > 0 THEN f.rr_dt END) AS last_sale_dt
  FROM public.wb_reports_fact f
  WHERE f.nm_id IS NOT NULL
    AND f.rr_dt BETWEEN p_from AND p_to
  GROUP BY f.nm_id;
$$;
