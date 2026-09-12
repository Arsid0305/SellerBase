-- New columns on wb_reports_fact for SPP / commission / kvw percentages
ALTER TABLE wb_reports_fact
  ADD COLUMN IF NOT EXISTS ppvz_spp_prc NUMERIC(8,3),
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(8,3),
  ADD COLUMN IF NOT EXISTS ppvz_kvw_prc NUMERIC(8,3);

-- Weekly P&L view matching owner's PL WB (нед) Excel formulas
CREATE OR REPLACE VIEW v_wb_pl_weekly
WITH (security_invoker = on)
AS
WITH base AS (
  SELECT
    realizationreport_id,
    MIN(rr_dt) AS week_from,
    MAX(rr_dt) AS week_to,
    COALESCE(SUM(quantity) FILTER (WHERE doc_type_name = 'Продажа'), 0) AS sales_qty,
    COALESCE(SUM(retail_price * quantity) FILTER (WHERE doc_type_name = 'Продажа'), 0)
      - COALESCE(SUM(retail_amount) FILTER (WHERE doc_type_name = 'Возврат'), 0) AS by_card_rub,
    COALESCE(SUM(CASE WHEN doc_type_name = 'Продажа' THEN retail_amount
                      WHEN doc_type_name = 'Возврат' THEN -retail_amount ELSE 0 END), 0) AS retail_net_rub,
    COALESCE(SUM(ppvz_for_pay), 0) AS ppvz_for_pay_rub,
    COALESCE(SUM(delivery_rub), 0) AS delivery_rub,
    COALESCE(SUM(storage_fee), 0) AS storage_fee,
    COALESCE(SUM(penalty), 0) AS penalty,
    COALESCE(SUM(acquiring_fee), 0) AS acquiring_fee,
    COALESCE(SUM(rebill_logistic_cost), 0) AS rebill_logistic_rub,
    COALESCE(SUM(deduction), 0) AS deduction_rub,
    COALESCE(SUM(additional_payment), 0) AS additional_payment,
    COALESCE(SUM(retail_amount) FILTER (WHERE doc_type_name = 'Возврат'), 0) AS returns_rub,
    COUNT(*) FILTER (WHERE doc_type_name = 'Возврат') AS returns_qty,
    CASE WHEN SUM(retail_amount) FILTER (WHERE doc_type_name = 'Продажа') > 0
      THEN ROUND(
        (SUM(ppvz_spp_prc * retail_amount) FILTER (WHERE doc_type_name = 'Продажа')
          / SUM(retail_amount) FILTER (WHERE doc_type_name = 'Продажа'))::numeric, 2)
      ELSE NULL
    END AS avg_spp_pct
  FROM wb_reports_fact
  WHERE realizationreport_id IS NOT NULL
  GROUP BY realizationreport_id
)
SELECT
  realizationreport_id,
  week_from,
  week_to,
  sales_qty,
  by_card_rub,
  retail_net_rub,
  ppvz_for_pay_rub,
  by_card_rub - ppvz_for_pay_rub AS commission_full_rub,
  CASE WHEN by_card_rub > 0
    THEN ROUND(((by_card_rub - ppvz_for_pay_rub) / by_card_rub * 100)::numeric, 2)
    ELSE NULL
  END AS commission_full_pct,
  delivery_rub,
  storage_fee,
  penalty,
  acquiring_fee,
  rebill_logistic_rub,
  deduction_rub,
  additional_payment,
  returns_rub,
  returns_qty,
  avg_spp_pct,
  ppvz_for_pay_rub - delivery_rub - storage_fee - penalty - acquiring_fee
    - rebill_logistic_rub - deduction_rub + additional_payment AS payout_rub
FROM base;
