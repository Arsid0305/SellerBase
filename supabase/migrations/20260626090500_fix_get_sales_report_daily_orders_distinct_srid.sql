-- Фикс #12 (средний чек 107₽): orders считались как COUNT строк wb_reports_fact
-- с quantity>0 — то есть включая ВСЕ типы операций (логистика, эквайринг, ...).
-- Реальные заказы = COUNT(DISTINCT srid) WHERE doc_type_name='Продажа' AND quantity>0.
-- Revenue также фильтруется по 'Продажа' (раньше брался любой положительный quantity).
-- Возвраты (поле cancellations) остаются как есть — это строки с quantity<0 / doc_type='Возврат'.
-- В UI подпись переименовывается на «Возвраты» (см. соответствующий коммит UI).
--
-- Сверка mcp.execute_sql за 30 дней (rules.md §16):
--   старая: orders=1790 → revenue/orders = 108₽
--   новая:  orders=434  → revenue/orders = 442₽
--
-- Настоящие отмены заказа (cancel_dt) живут в wb_orders_fact и не относятся
-- к финотчёту WB. Для них в /sales-report позже будет отдельный запрос.

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
    SUM(CASE WHEN doc_type_name='Продажа' AND quantity > 0 THEN retail_amount ELSE 0 END)::numeric AS revenue,
    SUM(CASE WHEN doc_type_name='Возврат' OR quantity < 0 THEN 1 ELSE 0 END)::int AS cancellations
  FROM public.wb_reports_fact
  WHERE rr_dt >= p_from AND rr_dt <= p_to
  GROUP BY rr_dt, nm_id, sa_name, barcode;
$function$;
