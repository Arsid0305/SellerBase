-- WB promotions (sales campaigns) — list of active and upcoming promos
-- with participating SKUs.
CREATE TABLE IF NOT EXISTS wb_promotions (
  promotion_id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  raw JSONB,
  debug_nomenclatures_raw JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wb_promotions_period_idx
  ON wb_promotions (start_at, end_at);

CREATE TABLE IF NOT EXISTS wb_promotion_items (
  promotion_id BIGINT REFERENCES wb_promotions(promotion_id) ON DELETE CASCADE,
  nm_id BIGINT NOT NULL,
  in_action BOOLEAN NOT NULL,
  current_price NUMERIC(12,2),
  plan_price NUMERIC(12,2),
  current_discount INTEGER,
  plan_discount INTEGER,
  user_participate BOOLEAN,
  user_decided_at TIMESTAMPTZ,
  user_note TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (promotion_id, nm_id)
);

CREATE INDEX IF NOT EXISTS wb_promotion_items_nm_idx
  ON wb_promotion_items (nm_id);

ALTER TABLE wb_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wb_promotion_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY wb_promotions_select_authenticated ON wb_promotions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY wb_promotion_items_select_authenticated ON wb_promotion_items
  FOR SELECT TO authenticated USING (true);
