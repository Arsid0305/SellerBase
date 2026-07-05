-- 11a: реклама wb_ads_fact в маржу.
-- get_full_pnl_by_period теперь суммирует маркетинг из двух источников:
--   1) wb_ads_fact.spend_rub (реальные списания WB Ads API) — по nm_id
--   2) marketing_expenses.amount_rub (ручные операции) — по sku_id
-- Обе суммы сводятся к sku_id через sku_catalog.wb_article.

CREATE OR REPLACE FUNCTION public.get_full_pnl_by_period(p_from date, p_to date)
 RETURNS TABLE(sku_id bigint, my_article text, wb_article bigint,
   revenue_rub numeric, commission_rub numeric, logistics_rub numeric, penalty_rub numeric,
   units_sold numeric, cogs_rub numeric, tax_rub numeric, marketing_rub numeric,
   net_profit_rub numeric, margin_pct numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  WITH pnl AS (SELECT * FROM public.get_pnl_by_period(p_from, p_to)),
  mkt_manual AS (
    SELECT sku_id, SUM(COALESCE(amount_rub, 0)) AS mkt
    FROM public.marketing_expenses
    WHERE expense_dt BETWEEN p_from AND p_to AND sku_id IS NOT NULL
    GROUP BY sku_id
  ),
  mkt_ads AS (
    SELECT s.id AS sku_id, SUM(COALESCE(a.spend_rub, 0)) AS mkt
    FROM public.wb_ads_fact a
    JOIN public.sku_catalog s ON s.wb_article = a.nm_id
    WHERE a.date BETWEEN p_from AND p_to AND a.nm_id IS NOT NULL
    GROUP BY s.id
  ),
  mkt AS (
    SELECT sku_id, SUM(mkt) AS marketing_rub
    FROM (SELECT sku_id, mkt FROM mkt_manual UNION ALL SELECT sku_id, mkt FROM mkt_ads) u
    GROUP BY sku_id
  )
  SELECT pnl.sku_id, pnl.my_article, pnl.wb_article,
    pnl.revenue_rub, pnl.commission_rub, pnl.logistics_rub, pnl.penalty_rub,
    pnl.units_sold, pnl.cogs_rub, pnl.tax_rub,
    COALESCE(mkt.marketing_rub, 0),
    pnl.net_profit_rub - COALESCE(mkt.marketing_rub, 0),
    CASE WHEN pnl.revenue_rub > 0
      THEN (pnl.net_profit_rub - COALESCE(mkt.marketing_rub, 0)) / pnl.revenue_rub * 100
      ELSE 0 END
  FROM pnl LEFT JOIN mkt ON mkt.sku_id = pnl.sku_id;
$function$;
