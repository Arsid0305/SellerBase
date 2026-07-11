-- PR-B v2: новая схема под FBW Supplies API (supplies-api.wildberries.ru).
-- Старая wb_supplies_fact — под мёртвый /api/v1/supplier/incomes (404), не удаляем чтоб не сломать v_supply_recommendation.
-- Здесь чистые таблицы под /api/v1/supplies и /api/v1/supplies/{id}/goods.

CREATE TABLE IF NOT EXISTS public.wb_supplies_v2 (
  id              text PRIMARY KEY,
  name            text,
  date_created    timestamptz,
  warehouse_id    bigint,
  warehouse_name  text,
  status          text,
  boxes_count     integer,
  fetched_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wb_supplies_v2_date_idx    ON public.wb_supplies_v2 (date_created DESC);
CREATE INDEX IF NOT EXISTS wb_supplies_v2_status_idx  ON public.wb_supplies_v2 (status);
CREATE INDEX IF NOT EXISTS wb_supplies_v2_warehouse_idx ON public.wb_supplies_v2 (warehouse_id);

CREATE TABLE IF NOT EXISTS public.wb_supply_items_v2 (
  id            bigserial PRIMARY KEY,
  supply_id     text NOT NULL REFERENCES public.wb_supplies_v2(id) ON DELETE CASCADE,
  nm_id         bigint,
  barcode       text,
  quantity      integer NOT NULL DEFAULT 0,
  size_name     text,
  fetched_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wb_supply_items_v2_uniq
  ON public.wb_supply_items_v2 (supply_id, nm_id, COALESCE(barcode, ''));
CREATE INDEX IF NOT EXISTS wb_supply_items_v2_nm_id_idx ON public.wb_supply_items_v2 (nm_id);

COMMENT ON TABLE public.wb_supplies_v2 IS 'FBW-поставки WB. Источник: supplies-api /api/v1/supplies.';
COMMENT ON TABLE public.wb_supply_items_v2 IS 'Товары в FBW-поставках. Источник: /api/v1/supplies/{id}/goods.';
