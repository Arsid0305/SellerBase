-- Замена .range(0, 200_000) в apps/web/src/entities/sources/queries.ts
-- (до 200k строк wb_reports_fact → ≤30 строк агрегата по складам).

CREATE OR REPLACE FUNCTION public.get_sources_by_period(p_from date, p_to date)
RETURNS TABLE(warehouse_name text, orders integer, units numeric, revenue numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT
    warehouse_name,
    COUNT(*)::int                       AS orders,
    SUM(quantity)::numeric              AS units,
    SUM(retail_amount)::numeric         AS revenue
  FROM public.wb_reports_fact
  WHERE rr_dt >= p_from AND rr_dt <= p_to
    AND warehouse_name IS NOT NULL
    AND quantity > 0
  GROUP BY warehouse_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_sources_by_period(date, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_sources_by_period(date, date) IS
'Агрегат wb_reports_fact по warehouse_name (orders/units/revenue) с фильтром quantity>0 (без возвратов). Замена .range(200_000) в sources/queries.ts.';
