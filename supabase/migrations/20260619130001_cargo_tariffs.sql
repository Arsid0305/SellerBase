-- Тарифы Карго — ручной ввод курса юаня/доллара и стоимости доставки 1 кг.
-- Используется на /products/costs для расчёта себестоимости товаров из Китая.

CREATE TABLE IF NOT EXISTS cargo_tariffs (
  id              BIGSERIAL PRIMARY KEY,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  cny_rate_rub    NUMERIC(10,4) NOT NULL,        -- курс юаня (₽ за 1 ¥)
  usd_rate_rub    NUMERIC(10,4),                 -- курс доллара (₽ за 1 $)
  cny_delivery_per_kg NUMERIC(10,4) NOT NULL,    -- стоимость доставки 1 кг (юаней)
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_cargo_tariffs_eff ON cargo_tariffs(effective_from DESC);

ALTER TABLE cargo_tariffs ENABLE ROW LEVEL SECURITY;
-- Без policies = доступ только через service_role (admin client), как у wb_orders_fact.

-- view: текущие действующие тарифы (последняя запись на сегодня)
CREATE OR REPLACE VIEW v_cargo_tariff_current
WITH (security_invoker = true)
AS
SELECT * FROM cargo_tariffs
WHERE effective_from <= CURRENT_DATE
ORDER BY effective_from DESC
LIMIT 1;
