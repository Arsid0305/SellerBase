-- Sat 2026-06-13: margin polish
-- 1) v_sku_weighted_tariff — средневзвешенный тариф WB по фактическому распределению
--    остатков SKU по складам.
-- 2) v_promo_margin_calc v4 — использует v_sku_weighted_tariff + реальную
--    оборачиваемость как срок хранения (capped 30..365 дней).
-- 3) Бэкфил недостающих subject_name для 9 SKU (8 Капы, 1 Эспандеры).

CREATE OR REPLACE VIEW v_sku_weighted_tariff
WITH (security_invoker = on)
AS
WITH latest_tariff AS (
  SELECT warehouse_name, box_delivery_base, box_delivery_liter,
         box_storage_base, box_storage_liter, warehouse_coef/100.0 AS wh_coef
  FROM wb_tariffs_box
  WHERE effective_date = (SELECT MAX(effective_date) FROM wb_tariffs_box)
),
sku_stocks AS (
  SELECT nm_id, warehouse_name, SUM(quantity) AS qty
  FROM wb_stocks GROUP BY nm_id, warehouse_name
)
SELECT
  s.nm_id,
  SUM(s.qty) AS total_stock,
  ROUND((SUM(t.box_delivery_base * t.wh_coef * s.qty) / NULLIF(SUM(s.qty),0))::numeric, 2) AS w_log_base,
  ROUND((SUM(t.box_delivery_liter * t.wh_coef * s.qty) / NULLIF(SUM(s.qty),0))::numeric, 2) AS w_log_extra,
  ROUND((SUM(t.box_storage_base * t.wh_coef * s.qty) / NULLIF(SUM(s.qty),0))::numeric, 4) AS w_stor_base
FROM sku_stocks s
JOIN latest_tariff t ON t.warehouse_name = s.warehouse_name
GROUP BY s.nm_id;

DROP VIEW IF EXISTS v_promo_margin_calc;
CREATE VIEW v_promo_margin_calc
WITH (security_invoker = on)
AS
WITH sett AS (
  SELECT
    (SELECT value FROM pricing_settings WHERE key='usn_rate') AS usn,
    (SELECT value FROM pricing_settings WHERE key='logistics_return') AS log_return
),
sku_turn AS (
  SELECT nm_id, LEAST(GREATEST(COALESCE(turnover_days, 90), 30), 365) AS days
  FROM v_turnover_by_sku
),
fallback_tariff AS (
  SELECT AVG(box_delivery_base*warehouse_coef/100.0) AS fb_log_base,
         AVG(box_delivery_liter*warehouse_coef/100.0) AS fb_log_extra,
         AVG(box_storage_base*warehouse_coef/100.0) AS fb_stor_base
  FROM wb_tariffs_box
  WHERE effective_date = (SELECT MAX(effective_date) FROM wb_tariffs_box)
)
SELECT
  pi.promotion_id, p.name AS promotion_name, pi.nm_id,
  sc.my_article, sc.title, sc.subject_name,
  sc.cost_price_rub AS cost_to_wb, sc.volume_l,
  pi.current_price, pi.plan_price, pi.plan_discount,
  COALESCE(c.kgvp_supplier, 25) AS comm_pct,
  COALESCE(st.days, 90) AS storage_days_used,
  ROUND((CASE WHEN sc.volume_l > 1
    THEN COALESCE(wt.w_log_base, ft.fb_log_base)
       + COALESCE(wt.w_log_extra, ft.fb_log_extra) * (sc.volume_l - 1)
    ELSE COALESCE(wt.w_log_base, ft.fb_log_base)
  END + sett.log_return)::numeric, 2) AS logistics_rub,
  ROUND((COALESCE(wt.w_stor_base, ft.fb_stor_base) * sc.volume_l * COALESCE(st.days, 90))::numeric, 2) AS storage_rub,
  CASE WHEN pi.current_price > 0 THEN
    ROUND(((pi.current_price - sc.cost_price_rub
       - pi.current_price * (COALESCE(c.kgvp_supplier, 25) / 100.0)
       - (CASE WHEN sc.volume_l > 1
            THEN COALESCE(wt.w_log_base, ft.fb_log_base)
               + COALESCE(wt.w_log_extra, ft.fb_log_extra) * (sc.volume_l - 1)
            ELSE COALESCE(wt.w_log_base, ft.fb_log_base)
          END + sett.log_return)
       - (COALESCE(wt.w_stor_base, ft.fb_stor_base) * sc.volume_l * COALESCE(st.days, 90))
       - pi.current_price * sett.usn
      ) / pi.current_price)::numeric, 4)
  END AS margin_current_pct,
  CASE WHEN pi.plan_price > 0 THEN
    ROUND(((pi.plan_price - sc.cost_price_rub
       - pi.plan_price * (COALESCE(c.kgvp_supplier, 25) / 100.0)
       - (CASE WHEN sc.volume_l > 1
            THEN COALESCE(wt.w_log_base, ft.fb_log_base)
               + COALESCE(wt.w_log_extra, ft.fb_log_extra) * (sc.volume_l - 1)
            ELSE COALESCE(wt.w_log_base, ft.fb_log_base)
          END + sett.log_return)
       - (COALESCE(wt.w_stor_base, ft.fb_stor_base) * sc.volume_l * COALESCE(st.days, 90))
       - pi.plan_price * sett.usn
      ) / pi.plan_price)::numeric, 4)
  END AS margin_at_promo_pct,
  pi.user_participate
FROM wb_promotion_items pi
JOIN wb_promotions p ON p.promotion_id = pi.promotion_id
LEFT JOIN sku_catalog sc ON sc.wb_article = pi.nm_id
LEFT JOIN wb_commissions_by_subject c ON c.subject_name = sc.subject_name
LEFT JOIN v_sku_weighted_tariff wt ON wt.nm_id = pi.nm_id
LEFT JOIN sku_turn st ON st.nm_id = pi.nm_id
CROSS JOIN sett
CROSS JOIN fallback_tariff ft;

-- Cron: обновление комиссий раз в неделю, понедельник 05:00 UTC = 08:00 МСК
SELECT cron.schedule(
  'fetch-wb-commissions-weekly',
  '0 5 * * 1',
  $$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-commissions',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );$$
);
