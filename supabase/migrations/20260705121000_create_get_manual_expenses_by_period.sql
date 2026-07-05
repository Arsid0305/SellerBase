-- 18a: Прочие ручные расходы в P&L.
-- RPC агрегирует manual_expenses по категориям за период.

CREATE OR REPLACE FUNCTION public.get_manual_expenses_by_period(p_from date, p_to date)
 RETURNS TABLE(category text, amount_rub numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT category, SUM(COALESCE(amount_rub, 0))
  FROM public.manual_expenses
  WHERE dt BETWEEN p_from AND p_to
  GROUP BY category;
$function$;
