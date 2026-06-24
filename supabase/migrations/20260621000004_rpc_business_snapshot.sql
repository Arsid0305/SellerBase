-- Замена трёх .range(0, 200_000) в apps/web/src/entities/business-snapshot/queries.ts.

-- 1. Revenue + orders за 30д.
CREATE OR REPLACE FUNCTION public.get_snapshot_revenue_orders(p_from date, p_date date)
RETURNS TABLE(revenue numeric, orders numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT
    COALESCE(SUM(retail_amount), 0)::numeric,
    COALESCE(SUM(quantity), 0)::numeric
  FROM public.wb_reports_fact
  WHERE rr_dt >= p_from AND rr_dt <= p_date AND quantity > 0;
$$;

GRANT EXECUTE ON FUNCTION public.get_snapshot_revenue_orders(date, date) TO authenticated, service_role;

-- 2. Top-10 SKU по выручке за 30д.
CREATE OR REPLACE FUNCTION public.get_snapshot_top_skus(p_from date, p_date date)
RETURNS TABLE(nm_id integer, revenue numeric, orders numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT
    nm_id,
    SUM(retail_amount)::numeric AS revenue,
    SUM(quantity)::numeric      AS orders
  FROM public.wb_reports_fact
  WHERE rr_dt >= p_from AND rr_dt <= p_date AND quantity > 0 AND nm_id IS NOT NULL
  GROUP BY nm_id
  ORDER BY revenue DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.get_snapshot_top_skus(date, date) TO authenticated, service_role;

-- 3. Дневной агрегат по (nm_id, rr_dt) для z-score аномалий.
CREATE OR REPLACE FUNCTION public.get_snapshot_anomalies_daily(p_from date, p_date date)
RETURNS TABLE(nm_id integer, rr_dt date, units numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT
    nm_id,
    rr_dt,
    SUM(quantity)::numeric
  FROM public.wb_reports_fact
  WHERE rr_dt >= p_from AND rr_dt <= p_date AND quantity > 0 AND nm_id IS NOT NULL
  GROUP BY nm_id, rr_dt;
$$;

GRANT EXECUTE ON FUNCTION public.get_snapshot_anomalies_daily(date, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_snapshot_revenue_orders(date, date) IS 'Замена .range(200_000) в business-snapshot fetchRevenueOrders.';
COMMENT ON FUNCTION public.get_snapshot_top_skus(date, date)        IS 'Замена .range(200_000) в business-snapshot fetchTopSkus (top-10 по revenue).';
COMMENT ON FUNCTION public.get_snapshot_anomalies_daily(date, date) IS 'Замена .range(200_000) в business-snapshot fetchAnomaliesForDate — дневной агрегат по (nm_id, rr_dt) для z-score.';
