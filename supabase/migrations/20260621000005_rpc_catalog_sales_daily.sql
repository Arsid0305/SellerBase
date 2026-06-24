-- Замена .range(0, 200_000) в apps/web/src/entities/catalog/queries.ts (fetchCatalog).
-- Дневной агрегат по (nm_id, rr_dt) за период — sparkline+summary считаются в JS из result-rows.

CREATE OR REPLACE FUNCTION public.get_catalog_sales_daily(p_since date, p_nm_ids bigint[])
RETURNS TABLE(
  nm_id bigint,
  rr_dt date,
  revenue numeric,
  units   numeric,
  profit  numeric,
  cost    numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT
    nm_id,
    rr_dt,
    SUM(retail_amount)::numeric,
    SUM(quantity)::numeric,
    SUM(retail_amount - COALESCE(commission_rub, 0) - COALESCE(delivery_rub, 0) - COALESCE(penalty, 0))::numeric,
    SUM(COALESCE(commission_rub, 0) + COALESCE(delivery_rub, 0) + COALESCE(penalty, 0))::numeric
  FROM public.wb_reports_fact
  WHERE rr_dt >= p_since AND nm_id = ANY(p_nm_ids)
  GROUP BY nm_id, rr_dt;
$$;

GRANT EXECUTE ON FUNCTION public.get_catalog_sales_daily(date, bigint[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_catalog_sales_daily(date, bigint[]) IS
'Дневной агрегат wb_reports_fact по (nm_id, rr_dt) для catalog: revenue/units/profit/cost. Замена .range(200_000) в catalog/queries.ts.';
