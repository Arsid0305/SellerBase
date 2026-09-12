CREATE TABLE IF NOT EXISTS sku_cost_history (
  id BIGSERIAL PRIMARY KEY,
  sku_id BIGINT NOT NULL REFERENCES sku_catalog(id) ON DELETE CASCADE,
  cost_rub NUMERIC(12,2) NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sku_cost_history_sku_valid_idx ON sku_cost_history(sku_id, valid_from DESC);
ALTER TABLE sku_cost_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON sku_cost_history FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION close_previous_cost() RETURNS TRIGGER AS $$
BEGIN
  UPDATE sku_cost_history
  SET valid_to = NEW.valid_from - INTERVAL '1 day'
  WHERE sku_id = NEW.sku_id AND valid_to IS NULL AND id <> NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sku_cost_history_close_prev ON sku_cost_history;
CREATE TRIGGER sku_cost_history_close_prev AFTER INSERT ON sku_cost_history
FOR EACH ROW EXECUTE FUNCTION close_previous_cost();
