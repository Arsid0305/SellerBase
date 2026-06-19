CREATE TABLE IF NOT EXISTS sku_events (
  id              BIGSERIAL PRIMARY KEY,
  sku_id          BIGINT NOT NULL REFERENCES sku_catalog(id) ON DELETE CASCADE,
  event_dt        TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type      TEXT NOT NULL,    -- 'lifecycle_changed' | 'price_changed' | 'rating_changed' | 'stock_zero' | 'promo_joined' | 'sales_resumed' | 'sales_stopped' | 'cost_updated' | 'anomaly_detected'
  severity        TEXT NOT NULL DEFAULT 'info',  -- 'info' | 'warn' | 'critical'
  title           TEXT NOT NULL,
  details         JSONB,           -- структурированные детали (старое/новое значение и т.п.)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_sku_events_sku ON sku_events(sku_id, event_dt DESC);
CREATE INDEX IF NOT EXISTS ix_sku_events_type ON sku_events(event_type, event_dt DESC);

ALTER TABLE sku_events ENABLE ROW LEVEL SECURITY;

-- Состояние детектора аномалий: последние замеченные значения метрик по SKU,
-- чтобы сравнивать "было/стало" между запусками крона (например, рейтинг 7д назад).
CREATE TABLE IF NOT EXISTS anomaly_state (
  sku_id          BIGINT NOT NULL REFERENCES sku_catalog(id) ON DELETE CASCADE,
  metric          TEXT NOT NULL,   -- 'rating' | 'stock_total' | 'last_sale_dt'
  value           JSONB NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sku_id, metric)
);

ALTER TABLE anomaly_state ENABLE ROW LEVEL SECURITY;
