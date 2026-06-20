-- v2: расширяет v_sku_cost_breakdown тремя доп. статьями расходов:
--   transport_to_ff_rub_per_unit  — доставка от поставщика до ФФ (вес * supplies_transport.rub_per_kg)
--   ff_service_rub_per_unit       — услуги ФФ на единицу (fulfillment_costs.rub_per_unit)
--   delivery_to_wb_rub_per_unit   — доставка от ФФ до склада ВБ (вес * delivery_to_wb.rub_per_kg)
--   total_with_extras_rub_per_unit — total_cost_rub_per_unit + сумма трёх статей выше (NULL-safe)
--
-- total_cost_rub_per_unit (старая колонка) НЕ меняется — обратная совместимость.
-- Вес берётся из sku_catalog.unit_weight_kg (если не задан — доп.статьи = NULL, не 0,
-- чтобы отличать «нет данных о весе» от «тариф 0»).

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
),
extra_tariffs AS (
  SELECT * FROM public.v_extra_tariffs_current
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
  COALESCE(uc.source, cc.source, kc.source, 'none') AS source,
  -- Доп. статьи расходов (ручные тарифы), NULL если нет данных о весе/тарифе
  (s.unit_weight_kg * et.supplies_transport_rub_per_kg) AS transport_to_ff_rub_per_unit,
  et.fulfillment_rub_per_unit AS ff_service_rub_per_unit,
  (s.unit_weight_kg * et.delivery_to_wb_rub_per_kg) AS delivery_to_wb_rub_per_unit,
  COALESCE(uc.total_cost_rub_per_unit, cc.total_cost_rub_per_unit, kc.total_cost_rub_per_unit, 0)
    + COALESCE(s.unit_weight_kg * et.supplies_transport_rub_per_kg, 0)
    + COALESCE(et.fulfillment_rub_per_unit, 0)
    + COALESCE(s.unit_weight_kg * et.delivery_to_wb_rub_per_kg, 0)
    AS total_with_extras_rub_per_unit
FROM public.sku_catalog s
LEFT JOIN unit_cost uc ON uc.sku_id = s.id
LEFT JOIN calc_cost cc ON cc.sku_id = s.id
LEFT JOIN catalog_cost kc ON kc.sku_id = s.id
CROSS JOIN extra_tariffs et;
