-- get_daily_pnl_series v2: полная маржа с cogs/tax/storage/acquiring
--
-- Раньше формула margin = (revenue - commission - logistics - penalty) / revenue давала ~75% —
-- не учитывала себестоимость, налог, хранение, эквайринг, возвратную логистику.
-- Теперь возвращаем net_profit_rub и margin_pct, посчитанные так же как в get_pnl_by_period
-- (revenue = R14, profit от ppvz_for_pay − все расходы − cogs − tax).

CREATE OR REPLACE FUNCTION public.get_daily_pnl_series(p_from date, p_to date)
RETURNS TABLE(
  rr_dt date,
  revenue_rub numeric,
  commission_rub numeric,
  logistics_rub numeric,
  penalty_rub numeric,
  net_profit_rub numeric,
  margin_pct numeric
)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  WITH base AS (
    SELECT
      f.rr_dt::date AS d,
      f.nm_id,
      CASE WHEN f.doc_type_name = 'Продажа' THEN COALESCE(f.retail_price, 0) * COALESCE(f.quantity, 0)
           WHEN f.doc_type_name = 'Возврат' THEN -COALESCE(f.retail_amount, 0)
           ELSE 0 END AS revenue,
      CASE WHEN f.doc_type_name = 'Продажа' THEN COALESCE(f.quantity, 0)
           WHEN f.doc_type_name = 'Возврат' THEN -COALESCE(f.quantity, 0)
           ELSE 0 END AS qty,
      COALESCE(f.ppvz_for_pay, 0) AS ppvz,
      COALESCE(f.delivery_rub, 0) + COALESCE(f.rebill_logistic_cost, 0) AS logistics,
      COALESCE(f.storage_fee, 0) AS storage,
      COALESCE(f.acquiring_fee, 0) AS acquiring,
      COALESCE(f.deduction, 0) AS deduction,
      COALESCE(f.penalty, 0) AS penalty,
      COALESCE(f.commission_rub, 0) AS commission_db
    FROM public.wb_reports_fact f
    WHERE f.rr_dt::date BETWEEN p_from AND p_to
  ),
  joined AS (
    SELECT
      b.d,
      SUM(b.revenue) AS revenue,
      SUM(b.ppvz) AS ppvz,
      SUM(b.logistics) AS logistics,
      SUM(b.storage) AS storage,
      SUM(b.acquiring) AS acquiring,
      SUM(b.deduction) AS deduction,
      SUM(b.penalty) AS penalty,
      SUM(b.qty * COALESCE(s.cost_price_rub, 0)) AS cogs,
      SUM(b.commission_db) AS commission_db
    FROM base b
    LEFT JOIN public.sku_catalog s ON s.wb_article = b.nm_id
    GROUP BY b.d
  )
  SELECT
    j.d AS rr_dt,
    j.revenue AS revenue_rub,
    (j.revenue - j.ppvz) AS commission_rub,
    j.logistics AS logistics_rub,
    j.penalty AS penalty_rub,
    (j.ppvz - j.logistics - j.storage - j.acquiring - j.deduction - j.penalty - j.cogs - j.revenue * public.app_setting_num('tax_rate')) AS net_profit_rub,
    CASE WHEN j.revenue > 0
      THEN (j.ppvz - j.logistics - j.storage - j.acquiring - j.deduction - j.penalty - j.cogs - j.revenue * public.app_setting_num('tax_rate')) / j.revenue * 100
      ELSE 0 END AS margin_pct
  FROM joined j
  ORDER BY j.d;
$function$;
