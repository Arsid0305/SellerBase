-- Покупательская персона: типовой покупатель моих товаров
CREATE TABLE IF NOT EXISTS customer_personas (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,                        -- 'Мама малыша 1-3 года', 'Фитнес-энтузиаст 25-35'
  description TEXT,
  age_min INT,
  age_max INT,
  gender TEXT,                                -- 'female' | 'male' | 'any'
  income_level TEXT,                          -- 'low' | 'mid' | 'high'
  notes JSONB,                                -- произвольные характеристики
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE customer_personas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON customer_personas;
CREATE POLICY "service_role_all" ON customer_personas FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Сценарий покупки: контекст в котором покупатель приходит за товаром
-- Один товар может удовлетворять несколько сценариев.
CREATE TABLE IF NOT EXISTS purchase_scenarios (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,                       -- 'Подарок маме на 8 марта', 'Замена изношенному'
  description TEXT,
  trigger TEXT,                               -- что побуждает: 'праздник', 'износ', 'апгрейд'
  urgency TEXT NOT NULL DEFAULT 'med',       -- 'low' | 'med' | 'high'
  price_sensitivity TEXT NOT NULL DEFAULT 'med',  -- 'low' | 'med' | 'high'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE purchase_scenarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON purchase_scenarios;
CREATE POLICY "service_role_all" ON purchase_scenarios FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Связь персоны и сценария: какие сценарии характерны для какой персоны
CREATE TABLE IF NOT EXISTS persona_scenarios (
  persona_id BIGINT NOT NULL REFERENCES customer_personas(id) ON DELETE CASCADE,
  scenario_id BIGINT NOT NULL REFERENCES purchase_scenarios(id) ON DELETE CASCADE,
  weight NUMERIC(3,2) NOT NULL DEFAULT 1.0,  -- насколько типичен сценарий для персоны
  PRIMARY KEY (persona_id, scenario_id)
);
ALTER TABLE persona_scenarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON persona_scenarios;
CREATE POLICY "service_role_all" ON persona_scenarios FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Связь товара со сценарием: какой товар удовлетворяет какой сценарий
CREATE TABLE IF NOT EXISTS sku_scenarios (
  sku_id BIGINT NOT NULL REFERENCES sku_catalog(id) ON DELETE CASCADE,
  scenario_id BIGINT NOT NULL REFERENCES purchase_scenarios(id) ON DELETE CASCADE,
  fit_score NUMERIC(3,2) NOT NULL DEFAULT 0.5, -- 0..1, насколько товар закрывает сценарий
  PRIMARY KEY (sku_id, scenario_id)
);
ALTER TABLE sku_scenarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON sku_scenarios;
CREATE POLICY "service_role_all" ON sku_scenarios FOR ALL TO service_role USING (true) WITH CHECK (true);
