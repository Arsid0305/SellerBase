-- Тарифы дополнительных расходов на доставку и услуги ФФ.
-- Ручной ввод как cargo_tariffs.

CREATE TABLE IF NOT EXISTS supplies_transport (
  id              BIGSERIAL PRIMARY KEY,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  rub_per_kg      NUMERIC(10,4) NOT NULL,
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_supplies_transport_eff ON supplies_transport(effective_from DESC);
ALTER TABLE supplies_transport ENABLE ROW LEVEL SECURITY;
-- Без policies = доступ только через service_role (admin client), как у cargo_tariffs.

CREATE TABLE IF NOT EXISTS fulfillment_costs (
  id              BIGSERIAL PRIMARY KEY,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  rub_per_unit    NUMERIC(10,4) NOT NULL,
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_fulfillment_costs_eff ON fulfillment_costs(effective_from DESC);
ALTER TABLE fulfillment_costs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS delivery_to_wb (
  id              BIGSERIAL PRIMARY KEY,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  rub_per_kg      NUMERIC(10,4) NOT NULL,
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_delivery_to_wb_eff ON delivery_to_wb(effective_from DESC);
ALTER TABLE delivery_to_wb ENABLE ROW LEVEL SECURITY;

-- View текущих действующих тарифов
CREATE OR REPLACE VIEW v_extra_tariffs_current
WITH (security_invoker = true)
AS
SELECT
  (SELECT rub_per_kg FROM supplies_transport WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) AS supplies_transport_rub_per_kg,
  (SELECT rub_per_unit FROM fulfillment_costs WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) AS fulfillment_rub_per_unit,
  (SELECT rub_per_kg FROM delivery_to_wb WHERE effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1) AS delivery_to_wb_rub_per_kg;
