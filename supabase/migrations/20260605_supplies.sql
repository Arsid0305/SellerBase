-- Поставщики на 1688 (несколько на один SKU)
CREATE TABLE IF NOT EXISTS sku_china_suppliers (
  id BIGSERIAL PRIMARY KEY,
  sku_id BIGINT NOT NULL REFERENCES sku_catalog(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  link_1688 TEXT NOT NULL,
  price_cny NUMERIC(10,2),
  is_default BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sku_china_suppliers_sku_idx ON sku_china_suppliers(sku_id);
ALTER TABLE sku_china_suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON sku_china_suppliers;
CREATE POLICY "service_role_all" ON sku_china_suppliers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Остатки дома и в фулфилменте
CREATE TABLE IF NOT EXISTS external_stock (
  id BIGSERIAL PRIMARY KEY,
  sku_id BIGINT NOT NULL REFERENCES sku_catalog(id) ON DELETE CASCADE,
  location TEXT NOT NULL CHECK (location IN ('home', 'ff')),
  quantity INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sku_id, location)
);
CREATE INDEX IF NOT EXISTS external_stock_sku_idx ON external_stock(sku_id);
ALTER TABLE external_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON external_stock;
CREATE POLICY "service_role_all" ON external_stock FOR ALL TO service_role USING (true) WITH CHECK (true);

-- План поставки (история)
CREATE TABLE IF NOT EXISTS supply_plans (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'sent_to_ff' | 'sent_to_china' | 'received' | 'cancelled'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE supply_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON supply_plans;
CREATE POLICY "service_role_all" ON supply_plans FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Позиции плана по складам WB (что куда везти)
CREATE TABLE IF NOT EXISTS supply_plan_items (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES supply_plans(id) ON DELETE CASCADE,
  sku_id BIGINT NOT NULL REFERENCES sku_catalog(id) ON DELETE CASCADE,
  warehouse_name TEXT NOT NULL,
  qty INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS supply_plan_items_plan_idx ON supply_plan_items(plan_id);
ALTER TABLE supply_plan_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON supply_plan_items;
CREATE POLICY "service_role_all" ON supply_plan_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Закупочные позиции (1688)
CREATE TABLE IF NOT EXISTS supply_plan_china (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES supply_plans(id) ON DELETE CASCADE,
  sku_id BIGINT NOT NULL REFERENCES sku_catalog(id) ON DELETE CASCADE,
  supplier_id BIGINT REFERENCES sku_china_suppliers(id) ON DELETE SET NULL,
  qty INT NOT NULL DEFAULT 0,
  price_cny NUMERIC(10,2)
);
ALTER TABLE supply_plan_china ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON supply_plan_china;
CREATE POLICY "service_role_all" ON supply_plan_china FOR ALL TO service_role USING (true) WITH CHECK (true);
