-- Subject (категория) на каждом SKU + комиссии по факту из WB API в маржу.
-- Бэкфил выполнялся отдельным запросом из wb_reports_fact_raw.payload.

ALTER TABLE sku_catalog
  ADD COLUMN IF NOT EXISTS subject_id BIGINT,
  ADD COLUMN IF NOT EXISTS subject_name TEXT;

CREATE INDEX IF NOT EXISTS sku_catalog_subject_idx ON sku_catalog (subject_name);

-- v_promo_margin_calc — переписан под реальные данные WB API:
-- - Комиссия: wb_commissions_by_subject.kgvp_supplier (FBO) по subject_name.
-- - Логистика/хранение: wb_tariffs_box (последняя дата, Коледино как baseline).
-- - УСН: pricing_settings.usn_rate (7% по умолчанию).
-- - Кешбэк/Клуб удалены — они уже учтены в фактических данных wb_reports_fact.
DROP VIEW IF EXISTS v_promo_margin_calc;

CREATE VIEW v_promo_margin_calc
WITH (security_invoker = on)
AS
WITH sett AS (
  SELECT
    (SELECT value FROM pricing_settings WHERE key='usn_rate') AS usn,
    (SELECT value FROM pricing_settings WHERE key='logistics_return') AS log_return,
    (SELECT value FROM pricing_settings WHERE key='avg_storage_days') AS stor_days
),
tariff AS (
  SELECT
    AVG(box_delivery_base)  AS log_base,
    AVG(box_delivery_liter) AS log_extra,
    AVG(box_storage_base)   AS stor_base,
    AVG(box_storage_liter)  AS stor_extra,
    AVG(warehouse_coef)/100.0 AS wh_coef
  FROM wb_tariffs_box
  WHERE effective_date = (SELECT MAX(effective_date) FROM wb_tariffs_box)
    AND warehouse_name = 'Коледино'
)
SELECT
  pi.promotion_id,
  p.name AS promotion_name,
  pi.nm_id,
  sc.my_article,
  sc.title,
  sc.subject_name,
  sc.cost_price_rub AS cost_to_wb,
  sc.volume_l,
  pi.current_price,
  pi.plan_price,
  pi.plan_discount,
  COALESCE(c.kgvp_supplier, 25) AS comm_pct,
  ROUND(((CASE WHEN sc.volume_l > 1
    THEN (t.log_base + t.log_extra * (sc.volume_l - 1)) * t.wh_coef
    ELSE t.log_base * t.wh_coef
  END + sett.log_return))::numeric, 2) AS logistics_rub,
  ROUND((t.stor_base * sc.volume_l * t.wh_coef * sett.stor_days)::numeric, 2) AS storage_rub,
  CASE WHEN pi.current_price > 0 THEN
    ROUND(((pi.current_price - sc.cost_price_rub
       - pi.current_price * (COALESCE(c.kgvp_supplier, 25) / 100.0)
       - (CASE WHEN sc.volume_l > 1
            THEN (t.log_base + t.log_extra*(sc.volume_l-1)) * t.wh_coef
            ELSE t.log_base * t.wh_coef
          END + sett.log_return)
       - (t.stor_base * sc.volume_l * t.wh_coef * sett.stor_days)
       - pi.current_price * sett.usn
      ) / pi.current_price)::numeric, 4)
  END AS margin_current_pct,
  CASE WHEN pi.plan_price > 0 THEN
    ROUND(((pi.plan_price - sc.cost_price_rub
       - pi.plan_price * (COALESCE(c.kgvp_supplier, 25) / 100.0)
       - (CASE WHEN sc.volume_l > 1
            THEN (t.log_base + t.log_extra*(sc.volume_l-1)) * t.wh_coef
            ELSE t.log_base * t.wh_coef
          END + sett.log_return)
       - (t.stor_base * sc.volume_l * t.wh_coef * sett.stor_days)
       - pi.plan_price * sett.usn
      ) / pi.plan_price)::numeric, 4)
  END AS margin_at_promo_pct,
  pi.user_participate
FROM wb_promotion_items pi
JOIN wb_promotions p ON p.promotion_id = pi.promotion_id
LEFT JOIN sku_catalog sc ON sc.wb_article = pi.nm_id
LEFT JOIN wb_commissions_by_subject c ON c.subject_name = sc.subject_name
CROSS JOIN sett
CROSS JOIN tariff t;
