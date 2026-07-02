-- Возвращает SUM(storage_fee), SUM(deduction), SUM(penalty) за период по всем строкам wb_reports_fact.
-- Используется в /pnl «Структура расходов» чтобы показать все статьи которые вычитаются из net_profit.

CREATE OR REPLACE FUNCTION public.get_wb_extra_expenses_by_period(p_from date, p_to date)
 RETURNS TABLE(storage_rub numeric, deduction_rub numeric, penalty_rub numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT
    COALESCE(SUM(storage_fee), 0)::numeric AS storage_rub,
    COALESCE(SUM(deduction), 0)::numeric   AS deduction_rub,
    COALESCE(SUM(penalty), 0)::numeric     AS penalty_rub
  FROM public.wb_reports_fact
  WHERE rr_dt::date BETWEEN p_from AND p_to;
$function$;
