CREATE TABLE IF NOT EXISTS sku_snapshots (
  id BIGSERIAL PRIMARY KEY,
  sku_id BIGINT NOT NULL REFERENCES sku_catalog(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  title TEXT,
  brand TEXT,
  category TEXT,
  price_rub NUMERIC(12,2),
  rating NUMERIC(3,2),
  reviews_count INT,
  is_active BOOLEAN,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sku_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS sku_snapshots_sku_date_idx ON sku_snapshots(sku_id, snapshot_date DESC);
ALTER TABLE sku_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON sku_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE VIEW v_sku_snapshot_diffs AS
SELECT
  s.sku_id,
  s.snapshot_date,
  s.title,
  s.brand,
  s.price_rub,
  s.rating,
  s.reviews_count,
  s.is_active,
  LAG(s.price_rub) OVER (PARTITION BY s.sku_id ORDER BY s.snapshot_date) AS prev_price_rub,
  LAG(s.rating) OVER (PARTITION BY s.sku_id ORDER BY s.snapshot_date) AS prev_rating,
  LAG(s.reviews_count) OVER (PARTITION BY s.sku_id ORDER BY s.snapshot_date) AS prev_reviews_count,
  LAG(s.title) OVER (PARTITION BY s.sku_id ORDER BY s.snapshot_date) AS prev_title
FROM sku_snapshots s;
