-- View итоговой разбивки себестоимости «до ВБ» по каждому SKU.
-- Источники приоритета:
--   1. Последняя запись sku_cost_history (если есть) — это итоговая ручная цифра из UNIT-импорта владелицы
--   2. Иначе — последний cogs_calculations (по shipment_id)
--   3. Иначе — sku_catalog.cost_price_rub (legacy)
--
-- Каждая колонка показывает разбивку:
--   purchase_rub_per_unit  — закупка в Китае (¥ × курс)
--   cargo_rub_per_unit     — карго-доставка (распределение по весу/qty)
--   customs_rub_per_unit   — таможня
--   packaging_rub_per_unit — упаковка на FF
--   total_cost_rub_per_unit — сумма (либо total из cogs_calculations, либо просто cost_price_rub если разбивки нет)
--   source                 — 'unit_import' | 'cogs_calc' | 'sku_catalog_legacy' | 'none'
--   effective_from         — дата вступления в силу

CREATE OR REPLACE VIEW public.v_sku_cost_breakdown
WITH (security_invoker = true)
AS
WITH
-- Самая свежая запись из sku_cost_history per SKU
unit_cost AS (
  SELECT DISTINCT ON (sku_id)
    sku_id,
    cost_rub AS total_cost_rub_per_unit,
    valid_from::timestamptz AS effective_from,
    'unit_import'::text AS source
  FROM public.sku_cost_history
  WHERE valid_to IS NULL OR valid_to > now()::date
  ORDER BY sku_id, valid_from DESC
),
-- Самый свежий расчёт cogs_calculations per SKU
calc_cost AS (
  SELECT DISTINCT ON (sku_id)
    sku_id,
    purchase_rub_per_unit,
    cargo_rub_per_unit,
    customs_rub_per_unit,
    packaging_rub_per_unit,
    total_cost_rub_per_unit,
    calculation_date AS effective_from,
    'cogs_calc'::text AS source
  FROM public.cogs_calculations
  ORDER BY sku_id, calculation_date DESC
),
-- Из каталога — fallback
catalog_cost AS (
  SELECT
    id AS sku_id,
    cost_price_rub AS total_cost_rub_per_unit,
    created_at AS effective_from,
    'sku_catalog_legacy'::text AS source
  FROM public.sku_catalog
  WHERE cost_price_rub IS NOT NULL AND cost_price_rub > 0
)
SELECT
  s.id AS sku_id,
  s.wb_article,
  s.my_article,
  s.title,
  COALESCE(uc.total_cost_rub_per_unit, cc.total_cost_rub_per_unit, kc.total_cost_rub_per_unit, 0) AS total_cost_rub_per_unit,
  -- Разбивка только если из cogs_calc, иначе NULL
  cc.purchase_rub_per_unit,
  cc.cargo_rub_per_unit,
  cc.customs_rub_per_unit,
  cc.packaging_rub_per_unit,
  COALESCE(uc.effective_from, cc.effective_from, kc.effective_from) AS effective_from,
  COALESCE(uc.source, cc.source, kc.source, 'none') AS source
FROM public.sku_catalog s
LEFT JOIN unit_cost uc ON uc.sku_id = s.id
LEFT JOIN calc_cost cc ON cc.sku_id = s.id
LEFT JOIN catalog_cost kc ON kc.sku_id = s.id;
