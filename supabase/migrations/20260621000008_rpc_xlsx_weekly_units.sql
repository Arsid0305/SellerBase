-- Замена .range(0, 200_000) в apps/web/src/app/api/finance/xlsx/route.ts.
-- Недельный агрегат SUM(quantity > 0) по ISO неделе.

CREATE OR REPLACE FUNCTION public.get_xlsx_weekly_units(p_year integer)
RETURNS TABLE(week integer, qty numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT
    EXTRACT(WEEK FROM rr_dt)::int AS week,
    SUM(quantity)::numeric        AS qty
  FROM public.wb_reports_fact
  WHERE rr_dt >= make_date(p_year, 1, 1)
    AND rr_dt <= make_date(p_year, 12, 31)
    AND quantity > 0
  GROUP BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_xlsx_weekly_units(integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_xlsx_weekly_units(integer) IS
'Недельный агрегат SUM(quantity > 0) wb_reports_fact для excel-экспорта (лист PL WB нед). Замена .range(200_000) в api/finance/xlsx/route.ts.';
