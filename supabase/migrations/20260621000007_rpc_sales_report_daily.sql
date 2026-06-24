-- Замена .range(0, 200_000) в apps/web/src/entities/sales-report/queries.ts.
-- Агрегат по (rr_dt, nm_id, sa_name, barcode) для построения 5 группировок (day/week/month/channel/product) в JS.

CREATE OR REPLACE FUNCTION public.get_sales_report_daily(p_from date, p_to date)
RETURNS TABLE(
  rr_dt date,
  nm_id bigint,
  sa_name text,
  barcode text,
  orders integer,
  units numeric,
  revenue numeric,
  cancellations integer
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT
    rr_dt,
    nm_id,
    sa_name,
    barcode,
    SUM(CASE WHEN quantity > 0 THEN 1 ELSE 0 END)::int      AS orders,
    SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END)::numeric AS units,
    SUM(CASE WHEN quantity > 0 THEN retail_amount ELSE 0 END)::numeric AS revenue,
    SUM(CASE WHEN quantity < 0 THEN 1 ELSE 0 END)::int      AS cancellations
  FROM public.wb_reports_fact
  WHERE rr_dt >= p_from AND rr_dt <= p_to
  GROUP BY rr_dt, nm_id, sa_name, barcode;
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_report_daily(date, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_sales_report_daily(date, date) IS
'Агрегат wb_reports_fact по (rr_dt, nm_id, sa_name, barcode) с orders/units/revenue/cancellations. Замена .range(200_000) в sales-report/queries.ts.';
