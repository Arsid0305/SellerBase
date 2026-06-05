-- Tasks layer: связь Goal → Tasks → SKU
-- Goals table may not yet exist (PR #57). FK to goals добавляется условно.

CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  goal_id BIGINT,
  sku_id BIGINT REFERENCES sku_catalog(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',     -- 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority TEXT NOT NULL DEFAULT 'med',    -- 'low' | 'med' | 'high'
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_goal_idx ON tasks(goal_id);
CREATE INDEX IF NOT EXISTS tasks_sku_idx ON tasks(sku_id);

-- Добавляем FK на goals только если таблица существует (создаётся в PR #57)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'goals') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'tasks_goal_id_fkey' AND table_name = 'tasks'
    ) THEN
      ALTER TABLE tasks
        ADD CONSTRAINT tasks_goal_id_fkey
        FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON tasks;
CREATE POLICY "service_role_all" ON tasks
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
