-- Доход = моя цена в карточке × количество. Та же логика что в pnl/catalog RPC.

CREATE OR REPLACE FUNCTION public.get_sales_report_daily(p_from date, p_to date)
 RETURNS TABLE(rr_dt date, nm_id bigint, sa_name text, barcode text, orders integer, units numeric, revenue numeric, cancellations integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT
    rr_dt,
    nm_id,
    sa_name,
    barcode,
    COUNT(DISTINCT srid) FILTER (WHERE doc_type_name='Продажа' AND quantity > 0)::int AS orders,
    SUM(CASE WHEN doc_type_name='Продажа' AND quantity > 0 THEN quantity ELSE 0 END)::numeric AS units,
    SUM(CASE WHEN doc_type_name='Продажа' AND quantity > 0 THEN COALESCE(retail_price, 0) * COALESCE(quantity, 0) ELSE 0 END)::numeric AS revenue,
    SUM(CASE WHEN doc_type_name='Возврат' OR quantity < 0 THEN 1 ELSE 0 END)::int AS cancellations
  FROM public.wb_reports_fact
  WHERE rr_dt >= p_from AND rr_dt <= p_to
  GROUP BY rr_dt, nm_id, sa_name, barcode;
$function$;
