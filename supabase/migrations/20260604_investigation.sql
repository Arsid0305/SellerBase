-- Проблема: что-то идёт не так. Может быть автоматически детектирована (аномалия) или создана вручную.
CREATE TABLE IF NOT EXISTS problems (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'med',   -- 'low' | 'med' | 'high' | 'critical'
  scope_sku_id BIGINT REFERENCES sku_catalog(id) ON DELETE SET NULL,
  scope_category TEXT,
  status TEXT NOT NULL DEFAULT 'open',     -- 'open' | 'investigating' | 'resolved' | 'closed'
  source TEXT NOT NULL DEFAULT 'manual',   -- 'manual' | 'anomaly' | 'goal_drift'
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS problems_status_idx ON problems(status);
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON problems;
CREATE POLICY "service_role_all" ON problems FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Расследование: процесс анализа проблемы. Одна проблема — одно расследование (или несколько).
CREATE TABLE IF NOT EXISTS investigations (
  id BIGSERIAL PRIMARY KEY,
  problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'paused' | 'completed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS investigations_problem_idx ON investigations(problem_id);
ALTER TABLE investigations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON investigations;
CREATE POLICY "service_role_all" ON investigations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Причина: гипотетическая или подтверждённая причина проблемы.
CREATE TABLE IF NOT EXISTS causes (
  id BIGSERIAL PRIMARY KEY,
  investigation_id BIGINT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  confidence INT NOT NULL DEFAULT 50,       -- 0..100
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS causes_investigation_idx ON causes(investigation_id);
ALTER TABLE causes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON causes;
CREATE POLICY "service_role_all" ON causes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Гипотеза: «если сделать X, то Y случится». Привязана к причине.
CREATE TABLE IF NOT EXISTS hypotheses (
  id BIGSERIAL PRIMARY KEY,
  cause_id BIGINT NOT NULL REFERENCES causes(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,                  -- «Если поднять цену на 5%, выручка вырастет, продажи не упадут»
  test_plan TEXT,                            -- как проверить
  status TEXT NOT NULL DEFAULT 'proposed',   -- 'proposed' | 'testing' | 'confirmed' | 'rejected'
  result TEXT,                               -- итог проверки
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hypotheses_cause_idx ON hypotheses(cause_id);
ALTER TABLE hypotheses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON hypotheses;
CREATE POLICY "service_role_all" ON hypotheses FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Знание: подтверждённый вывод из подтверждённой гипотезы. Растущая база знаний бизнеса.
CREATE TABLE IF NOT EXISTS knowledge (
  id BIGSERIAL PRIMARY KEY,
  hypothesis_id BIGINT REFERENCES hypotheses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  insight TEXT NOT NULL,
  category TEXT,                             -- 'pricing' | 'promotion' | 'stock' | 'content' | 'other'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON knowledge;
CREATE POLICY "service_role_all" ON knowledge FOR ALL TO service_role USING (true) WITH CHECK (true);
