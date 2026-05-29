-- Расширение sku_catalog для поддержки наборов (kits) и версионирования источника себестоимости.
--
-- bundle_type:
--   single        — один продаваемый товар = одна физическая позиция.
--   size_variant — одна WB-карточка, покупатель выбирает размер — 1шт = 1продажа.
--   kit          — набор из Н разных компонентов = 1продажа. cost = сумма компонентов.
--
-- cost_price_source:
--   'свободный текст' — откуда взято текущее значение cost_price_rub.
--   Примеры: 'sebes_xlsx_2026-05-29', 'shipment:42', 'manual'.
--
-- ozon_article:
--   Номенклатура OZON. Добавлена заранее для Phase 7 (Ozon).

alter table sku_catalog
  add column if not exists bundle_type text not null default 'single'
    check (bundle_type in ('single', 'size_variant', 'kit')),
  add column if not exists cost_price_source text,
  add column if not exists ozon_article bigint;
