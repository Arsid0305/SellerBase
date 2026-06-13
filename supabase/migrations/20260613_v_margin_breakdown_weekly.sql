-- Margin breakdown per SKU per ISO-week, decomposed into components as % of "by_card_rub"
-- (выручка по карточке = розничная цена × кол-во − возвраты руб).
--
-- Used by /analytics/margin to answer "почему маржа упала на этой неделе".

CREATE OR REPLACE VIEW v_margin_breakdown_weekly
WITH (security_invoker = on)
AS
WITH base AS (
  SELECT
    nm_id,
    date_trunc('week', rr_dt::timestamp)::date AS week_start,
    SUM(quantity) FILTER (WHERE doc_type_name = 'Продажа') AS sales_qty,
    SUM(retail_price * quantity) FILTER (WHERE doc_type_name = 'Продажа')
      - COALESCE(SUM(retail_amount) FILTER (WHERE doc_type_name = 'Возврат'), 0) AS by_card_rub,
    SUM(CASE WHEN doc_type_name = 'Продажа' THEN retail_amount
              WHEN doc_type_name = 'Возврат' THEN -retail_amount ELSE 0 END) AS retail_net_rub,
    SUM(ppvz_for_pay) AS ppvz_for_pay_rub,
    SUM(delivery_rub) AS logistics_rub,
    SUM(storage_fee) AS storage_rub,
    SUM(acquiring_fee) AS acquiring_rub,
    SUM(penalty) AS penalty_rub,
    SUM(deduction) AS deduction_rub,
    SUM(rebill_logistic_cost) AS rebill_logistic_rub,
    COALESCE(SUM(retail_amount) FILTER (WHERE doc_type_name = 'Возврат'), 0) AS returns_rub,
    COUNT(*) FILTER (WHERE doc_type_name = 'Возврат') AS returns_qty
  FROM wb_reports_fact
  WHERE nm_id IS NOT NULL
    AND rr_dt IS NOT NULL
  GROUP BY nm_id, date_trunc('week', rr_dt::timestamp)::date
)
SELECT
  b.nm_id,
  b.week_start,
  b.sales_qty,
  COALESCE(b.by_card_rub, 0) AS by_card_rub,
  COALESCE(b.retail_net_rub, 0) AS retail_net_rub,
  COALESCE(b.ppvz_for_pay_rub, 0) AS ppvz_for_pay_rub,
  COALESCE(b.by_card_rub, 0) - COALESCE(b.ppvz_for_pay_rub, 0) AS commission_full_rub,
  COALESCE(b.logistics_rub, 0) AS logistics_rub,
  COALESCE(b.storage_rub, 0) AS storage_rub,
  COALESCE(b.acquiring_rub, 0) AS acquiring_rub,
  COALESCE(b.penalty_rub, 0) AS penalty_rub,
  COALESCE(b.deduction_rub, 0) AS deduction_rub,
  COALESCE(b.rebill_logistic_rub, 0) AS rebill_logistic_rub,
  b.returns_rub,
  b.returns_qty,
  COALESCE(sc.cost_price_rub, 0) * COALESCE(b.sales_qty, 0) AS cogs_rub,
  -- net profit = ppvz_for_pay − все удержания − COGS − налог (УСН берётся из pricing_settings.usn_rate, default 0.07)
  COALESCE(b.ppvz_for_pay_rub, 0)
    - COALESCE(b.logistics_rub, 0)
    - COALESCE(b.storage_rub, 0)
    - COALESCE(b.acquiring_rub, 0)
    - COALESCE(b.penalty_rub, 0)
    - COALESCE(b.deduction_rub, 0)
    - COALESCE(b.rebill_logistic_rub, 0)
    - COALESCE(sc.cost_price_rub, 0) * COALESCE(b.sales_qty, 0)
    - COALESCE(b.by_card_rub, 0) * COALESCE(
        (SELECT value FROM pricing_settings WHERE key = 'usn_rate'),
        0.07
      ) AS net_profit_rub
FROM base b
LEFT JOIN sku_catalog sc ON sc.wb_article = b.nm_id
WHERE COALESCE(b.by_card_rub, 0) > 0;
