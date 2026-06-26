-- Per-SKU override тарифа ФФ. NULL → fallback на общий тариф из fulfillment_tariffs.
-- Закрывает половину #9b: возможность ручной корректировки ФФ-тарифа per SKU.

ALTER TABLE public.sku_catalog
  ADD COLUMN IF NOT EXISTS manual_ff_tariff_rub NUMERIC(10,2) NULL;
COMMENT ON COLUMN public.sku_catalog.manual_ff_tariff_rub IS 'Per-SKU override тарифа ФФ. NULL → fallback на общий тариф из fulfillment_tariffs.';
