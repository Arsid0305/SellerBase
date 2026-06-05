CREATE TABLE IF NOT EXISTS goals (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  metric TEXT NOT NULL,         -- 'revenue' | 'margin' | 'units' | 'custom'
  target_value NUMERIC(14,2),
  current_value NUMERIC(14,2),
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'achieved' | 'paused' | 'cancelled'
  scope TEXT NOT NULL DEFAULT 'all',      -- 'all' | 'sku' | 'category'
  scope_value TEXT,                       -- barcode/category name если scope != all
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goals_status_idx ON goals(status);
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON goals FOR ALL TO service_role USING (true) WITH CHECK (true);
