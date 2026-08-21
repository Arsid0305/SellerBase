-- Досоздание таблицы wb_goods_returns_events.
-- Миграция 20260613_wb_goods_returns_events.sql применилась частично: cron-задача
-- fetch-wb-goods-returns-daily зарегистрирована, CREATE TABLE не выполнен.
-- Из-за этого fetch-wb-goods-returns падал ежедневно, возвраты не собирались.
-- Cron здесь намеренно не трогаем: он уже пересоздан с авторизацией через Vault.
-- Применено через MCP apply_migration 2026-08-21.

CREATE TABLE IF NOT EXISTS public.wb_goods_returns_events (
  srid TEXT PRIMARY KEY,
  nm_id BIGINT,
  supplier_article TEXT,
  barcode TEXT,
  reason_code TEXT,
  reason_text TEXT,
  return_date TIMESTAMPTZ,
  status TEXT,
  raw JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wb_goods_returns_events_nm_idx
  ON public.wb_goods_returns_events (nm_id);
CREATE INDEX IF NOT EXISTS wb_goods_returns_events_date_idx
  ON public.wb_goods_returns_events (return_date);

ALTER TABLE public.wb_goods_returns_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wb_goods_returns_events_select_auth ON public.wb_goods_returns_events;
CREATE POLICY wb_goods_returns_events_select_auth ON public.wb_goods_returns_events
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.wb_goods_returns_events IS
  'Поэвентный лог возвратов покупателей. Ключ srid. Источник: seller-analytics-api /api/v1/analytics/goods-return. Дневные агрегаты — в wb_goods_returns.';
