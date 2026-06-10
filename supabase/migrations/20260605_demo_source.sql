-- Add `source` column to tables that participate in demo seed/clear.
-- `problems.source` already exists (added earlier). `source = 'demo'` marks demo data
-- so clear-mode can remove only seeded rows without touching real data.

ALTER TABLE goals ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE customer_personas ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE purchase_scenarios ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS goals_source_idx ON goals(source);
CREATE INDEX IF NOT EXISTS tasks_source_idx ON tasks(source);
CREATE INDEX IF NOT EXISTS customer_personas_source_idx ON customer_personas(source);
CREATE INDEX IF NOT EXISTS purchase_scenarios_source_idx ON purchase_scenarios(source);
