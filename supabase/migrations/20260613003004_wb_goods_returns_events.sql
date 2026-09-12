-- WB goods returns — per-event log of customer returns to seller.
-- Source: GET https://seller-analytics-api.wildberries.ru/api/v1/analytics/goods-return
-- ASSUMPTION: existing wb_goods_returns table (см. 20260611_wb_funnel_tables_and_views.sql)
-- хранит дневные агрегаты (nm_id+dt). Эта таблица — отдельный поэвентный лог,
-- ключ — srid (уникальный идентификатор возврата).
CREATE TABLE IF NOT EXISTS wb_goods_returns_events (
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
  ON wb_goods_returns_events (nm_id);
CREATE INDEX IF NOT EXISTS wb_goods_returns_events_date_idx
  ON wb_goods_returns_events (return_date);

ALTER TABLE wb_goods_returns_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY wb_goods_returns_events_select_auth ON wb_goods_returns_events
  FOR SELECT TO authenticated USING (true);

-- Cron daily 02:00 UTC — refresh last 30 days of return events
SELECT cron.schedule(
  'fetch-wb-goods-returns-daily',
  '0 2 * * *',
  $$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-goods-returns',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$$
);
