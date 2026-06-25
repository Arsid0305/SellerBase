-- Фикс #11 шаг 2: вести запрос от UNION(rev.nm_id, exp.nm_id), не от sku_catalog.
--
-- Корень: предыдущий шаг 1 (20260625231500) убрал фильтр doc_type_name из exp CTE,
-- но joined CTE по-прежнему шёл FROM sku_catalog LEFT JOIN rev/exp. nm_id'ы которых
-- нет в sku_catalog (общие статьи «Хранение/Удержание» и архивные SKU) выпадали
-- вместе со своими расходами.
--
-- Сверка через mcp.execute_sql на неделе 15-21 июня (rules.md §16):
--   шаг 1: profit_before_cogs/tax = 36 825 ₽ (РАЗНИЦА с raw = 29 438 ₽)
--   шаг 2: net_profit = -16 015 ₽, margin = -32% (совпадает с raw расчётом)
--
-- Потерянный nm_id за неделю нёс: storage 11 007 + deduction 17 936 + rebill 462 = 29 405 ₽.

CREATE OR REPLACE FUNCTION public.get_pnl_by_period(p_from date, p_to date)
 RETURNS TABLE(sku_id bigint, my_article text, wb_article bigint, revenue_rub numeric, commission_rub numeric, logistics_rub numeric, penalty_rub numeric, units_sold numeric, cogs_rub numeric, tax_rub numeric, net_profit_rub numeric, margin_pct numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  WITH rev AS (
    SELECT nm_id,
      SUM(CASE WHEN doc_type_name = 'Продажа' THEN COALESCE(retail_amount, 0)
               WHEN doc_type_name = 'Возврат' THEN -COALESCE(retail_amount, 0) ELSE 0 END) AS revenue_rub,
      SUM(CASE WHEN doc_type_name = 'Продажа' THEN COALESCE(ppvz_for_pay, 0)
               WHEN doc_type_name = 'Возврат' THEN -COALESCE(ppvz_for_pay, 0) ELSE 0 END) AS ppvz_for_pay_rub,
      SUM(CASE WHEN doc_type_name = 'Продажа' THEN COALESCE(quantity, 0)
               WHEN doc_type_name = 'Возврат' THEN -COALESCE(quantity, 0) ELSE 0 END)::NUMERIC AS units_sold
    FROM public.wb_reports_fact
    WHERE rr_dt::date BETWEEN p_from AND p_to
      AND doc_type_name IN ('Продажа','Возврат')
    GROUP BY nm_id
  ),
  exp AS (
    SELECT nm_id,
      SUM(COALESCE(delivery_rub, 0))          AS logistics_rub,
      SUM(COALESCE(penalty, 0))               AS penalty_rub,
      SUM(COALESCE(storage_fee, 0))           AS storage_rub,
      SUM(COALESCE(acquiring_fee, 0))         AS acquiring_rub,
      SUM(COALESCE(deduction, 0))             AS deduction_rub,
      SUM(COALESCE(rebill_logistic_cost, 0))  AS rebill_logistic_rub
    FROM public.wb_reports_fact
    WHERE rr_dt::date BETWEEN p_from AND p_to
    GROUP BY nm_id
  ),
  nm_all AS (
    SELECT nm_id FROM rev
    UNION
    SELECT nm_id FROM exp
  ),
  joined AS (
    SELECT
      s.id AS sku_id,
      s.my_article,
      COALESCE(s.wb_article, n.nm_id) AS wb_article,
      COALESCE(rev.revenue_rub, 0)            AS revenue_rub,
      COALESCE(rev.ppvz_for_pay_rub, 0)       AS ppvz_for_pay_rub,
      COALESCE(exp.logistics_rub, 0) + COALESCE(exp.rebill_logistic_rub, 0) AS logistics_rub,
      COALESCE(exp.penalty_rub, 0)            AS penalty_rub,
      COALESCE(exp.storage_rub, 0)            AS storage_rub,
      COALESCE(exp.acquiring_rub, 0)          AS acquiring_rub,
      COALESCE(exp.deduction_rub, 0)          AS deduction_rub,
      COALESCE(rev.units_sold, 0)             AS units_sold,
      COALESCE(s.cost_price_rub, 0) * GREATEST(COALESCE(rev.units_sold, 0), 0) AS cogs_rub,
      COALESCE(rev.revenue_rub, 0) * public.app_setting_num('tax_rate')        AS tax_rub
    FROM nm_all n
    LEFT JOIN rev ON rev.nm_id = n.nm_id
    LEFT JOIN exp ON exp.nm_id = n.nm_id
    LEFT JOIN public.sku_catalog s ON s.wb_article = n.nm_id
  )
  SELECT
    sku_id, my_article, wb_article,
    revenue_rub,
    revenue_rub - ppvz_for_pay_rub AS commission_rub,
    logistics_rub,
    penalty_rub,
    units_sold,
    cogs_rub,
    tax_rub,
    ppvz_for_pay_rub - logistics_rub - storage_rub - acquiring_rub - deduction_rub
      - penalty_rub - cogs_rub - tax_rub AS net_profit_rub,
    CASE WHEN revenue_rub > 0 THEN
      (ppvz_for_pay_rub - logistics_rub - storage_rub - acquiring_rub - deduction_rub
        - penalty_rub - cogs_rub - tax_rub) / revenue_rub * 100
      ELSE 0 END AS margin_pct
  FROM joined;
$function$;
