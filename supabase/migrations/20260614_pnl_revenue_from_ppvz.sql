-- get_pnl_by_period v2: убрать двойной счёт commission_rub
--
-- Раньше профит считался как (retail_amount − commission − logistics − ...).
-- Но в WB данных:
--   retail_amount = что заплатил покупатель (после СПП)
--   ppvz_for_pay = что вернулось продавцу
-- Комиссия WB фактически = retail_amount − ppvz_for_pay.
-- Когда мы дополнительно вычитали commission_rub (поле из БД) — это был двойной счёт,
-- плюс знак commission_rub в БД отрицательный (за 30д = −8 750),
-- что в старой формуле наоборот *прибавляло* к профиту.
--
-- Новая формула:
--   revenue_rub = SUM(retail_amount net Продажа − Возврат)  — для UI «Доходы» (что заплатил покупатель)
--   commission_rub = revenue_rub − SUM(ppvz_for_pay)        — эффективная WB-комиссия (положительная = WB удержал, отрицательная = СПП-компенсация больше)
--   net_profit   = SUM(ppvz_for_pay)
--                  − logistics − storage − acquiring − deduction − rebill_logistic − penalty
--                  − cogs × units − revenue × tax_rate

CREATE OR REPLACE FUNCTION public.get_pnl_by_period(p_from date, p_to date)
RETURNS TABLE(
  sku_id bigint, my_article text, wb_article bigint,
  revenue_rub numeric, commission_rub numeric, logistics_rub numeric,
  penalty_rub numeric, units_sold numeric, cogs_rub numeric, tax_rub numeric,
  net_profit_rub numeric, margin_pct numeric
)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  WITH rev AS (
    SELECT nm_id,
      SUM(CASE WHEN doc_type_name = 'Продажа' THEN COALESCE(retail_amount, 0)
               WHEN doc_type_name = 'Возврат' THEN -COALESCE(retail_amount, 0) ELSE 0 END) AS revenue_rub,
      SUM(CASE WHEN doc_type_name = 'Продажа' THEN COALESCE(quantity, 0)
               WHEN doc_type_name = 'Возврат' THEN -COALESCE(quantity, 0) ELSE 0 END)::NUMERIC AS units_sold
    FROM public.wb_reports_fact WHERE sale_dt::date BETWEEN p_from AND p_to GROUP BY nm_id
  ),
  exp AS (
    SELECT nm_id,
      SUM(COALESCE(ppvz_for_pay, 0))          AS ppvz_for_pay_rub,
      SUM(COALESCE(delivery_rub, 0))          AS logistics_rub,
      SUM(COALESCE(penalty, 0))               AS penalty_rub,
      SUM(COALESCE(storage_fee, 0))           AS storage_rub,
      SUM(COALESCE(acquiring_fee, 0))         AS acquiring_rub,
      SUM(COALESCE(deduction, 0))             AS deduction_rub,
      SUM(COALESCE(rebill_logistic_cost, 0))  AS rebill_logistic_rub
    FROM public.wb_reports_fact WHERE rr_dt::date BETWEEN p_from AND p_to GROUP BY nm_id
  ),
  joined AS (
    SELECT s.id AS sku_id, s.my_article, s.wb_article,
      COALESCE(rev.revenue_rub, 0)            AS revenue_rub,
      COALESCE(exp.ppvz_for_pay_rub, 0)       AS ppvz_for_pay_rub,
      COALESCE(exp.logistics_rub, 0) + COALESCE(exp.rebill_logistic_rub, 0) AS logistics_rub,
      COALESCE(exp.penalty_rub, 0)            AS penalty_rub,
      COALESCE(exp.storage_rub, 0)            AS storage_rub,
      COALESCE(exp.acquiring_rub, 0)          AS acquiring_rub,
      COALESCE(exp.deduction_rub, 0)          AS deduction_rub,
      COALESCE(rev.units_sold, 0)             AS units_sold,
      COALESCE(s.cost_price_rub, 0) * GREATEST(COALESCE(rev.units_sold, 0), 0) AS cogs_rub,
      COALESCE(rev.revenue_rub, 0) * public.app_setting_num('tax_rate')        AS tax_rub
    FROM public.sku_catalog s
    LEFT JOIN rev ON rev.nm_id = s.wb_article
    LEFT JOIN exp ON exp.nm_id = s.wb_article
    WHERE COALESCE(rev.revenue_rub, 0) > 0
       OR COALESCE(exp.ppvz_for_pay_rub, 0) <> 0
       OR COALESCE(exp.logistics_rub, 0) > 0
       OR COALESCE(exp.storage_rub, 0) > 0
       OR COALESCE(exp.acquiring_rub, 0) > 0
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
