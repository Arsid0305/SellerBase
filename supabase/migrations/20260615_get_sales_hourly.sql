-- Почасовая агрегация выкупов wb_sales_fact
-- Используется в WB-style графике на /dashboard для линий
-- Сегодня / Вчера / Неделя назад в разрезе часов.
CREATE OR REPLACE FUNCTION public.get_sales_hourly(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(
  hour timestamptz,
  count integer,
  sum_rub numeric
)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT
    date_trunc('hour', sale_ts) AS hour,
    count(*)::integer AS count,
    sum(COALESCE(for_pay, 0)) AS sum_rub
  FROM public.wb_sales_fact
  WHERE sale_ts >= p_from AND sale_ts < p_to AND COALESCE(is_storno, false) = false
  GROUP BY date_trunc('hour', sale_ts)
  ORDER BY hour;
$function$;
