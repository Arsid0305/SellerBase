-- RPC для data-quality channelGaps — distinct sale_dt/rr_dt за период.
-- Замена двух .range(0, 200_000)/50_000 в apps/web/src/entities/data-quality/queries.ts
-- (до 250k строк в RSC → до 60 строк distinct дат).

CREATE OR REPLACE FUNCTION public.get_channel_gap_dates(p_since date)
RETURNS TABLE(source text, dt date)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT 'wb_sales'::text,   sale_dt FROM public.wb_sales_fact   WHERE sale_dt >= p_since GROUP BY sale_dt
  UNION ALL
  SELECT 'wb_reports'::text, rr_dt   FROM public.wb_reports_fact WHERE rr_dt   >= p_since GROUP BY rr_dt;
$$;

GRANT EXECUTE ON FUNCTION public.get_channel_gap_dates(date) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_channel_gap_dates(date) IS
'Distinct sale_dt/rr_dt за период по двум каналам — для data-quality channelGaps. Замена .range(0, 200_000) в data-quality/queries.ts.';
