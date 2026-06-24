-- Замена двух .range(0, 200_000) / .range(0, 100_000) в apps/web/src/entities/supplies/queries.ts
-- (до 300k строк wb_reports_fact+wb_stocks → ≈1.2k строк агрегатов).

CREATE OR REPLACE FUNCTION public.get_supplies_stats(p_since date)
RETURNS TABLE(source text, nm_id integer, warehouse_name text, qty numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT 'sales'::text, nm_id, warehouse_name, SUM(quantity)::numeric
  FROM public.wb_reports_fact
  WHERE rr_dt >= p_since AND nm_id IS NOT NULL AND warehouse_name IS NOT NULL
  GROUP BY nm_id, warehouse_name
  UNION ALL
  SELECT 'stock'::text, nm_id, warehouse_name, SUM(quantity)::numeric
  FROM public.wb_stocks
  WHERE nm_id IS NOT NULL AND warehouse_name IS NOT NULL
  GROUP BY nm_id, warehouse_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplies_stats(date) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_supplies_stats(date) IS
'Агрегат продаж (wb_reports_fact с rr_dt >= p_since) и остатков (wb_stocks) по nm_id+warehouse_name. Замена .range(200_000) в supplies/queries.ts.';
