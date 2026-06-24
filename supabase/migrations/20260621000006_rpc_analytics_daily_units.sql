-- Замена .range(0, 200_000) в apps/web/src/entities/analytics/queries.ts.
-- Дневной агрегат SUM(quantity) по (nm_id, rr_dt) для расчёта XYZ-стабильности и матрицы.

CREATE OR REPLACE FUNCTION public.get_analytics_daily_units(p_from date, p_to date)
RETURNS TABLE(nm_id bigint, rr_dt date, units numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT
    nm_id,
    rr_dt,
    SUM(quantity)::numeric
  FROM public.wb_reports_fact
  WHERE rr_dt >= p_from AND rr_dt <= p_to AND quantity > 0 AND nm_id IS NOT NULL
  GROUP BY nm_id, rr_dt;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_daily_units(date, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_analytics_daily_units(date, date) IS
'Дневной агрегат SUM(quantity > 0) по (nm_id, rr_dt) для analytics: XYZ-стабильность и матрица. Замена .range(200_000) в analytics/queries.ts.';
