-- pgTAP unit tests for v_turnover_by_sku (оборачиваемость).
--
-- Запуск: psql $DATABASE_URL -f supabase/tests/turnover_tests.sql
--
-- Формула (supabase/migrations/20260611_v_turnover_by_sku.sql):
--   stock_qty            = SUM(wb_stocks.quantity) по nm_id
--   avg_orders_per_day_28d = AVG(wb_sales_funnel.order_count) за последние 28 дней
--   turnover_days         = stock_qty / avg_orders_per_day_28d
--   recommendation:
--     avg=0 AND stock>0   → 'нет продаж — критично'
--     stock=0             → 'нет стока'
--     turnover_days < 60        → 'норма'
--     turnover_days BETWEEN 60 AND 90 → 'акция полезна'
--     иначе (>90)          → 'срочно сливать'
--
-- Тестовые nm_id в диапазоне 900000001-900000099 чтобы не путаться с реальными данными.
-- view читает CURRENT_DATE - 28 дней, поэтому фикстуры дат привязаны к CURRENT_DATE.

BEGIN;

SELECT plan(8);

-- ============================================================
-- SKU A (nm_id 900000001): стабильная оборачиваемость, "норма"
-- stock_qty = 100, средние заказы/день за 28д = 5 → turnover_days = 20 (< 60 → норма)
-- ============================================================
INSERT INTO wb_stocks (barcode, nm_id, warehouse_name, quantity)
VALUES ('TEST-BC-1', 900000001, 'Test WH', 100);

INSERT INTO wb_sales_funnel (nm_id, dt, order_count)
SELECT 900000001, (CURRENT_DATE - g), 5
FROM generate_series(0, 27) AS g;

-- ============================================================
-- SKU B (nm_id 900000002): на грани, "акция полезна"
-- stock_qty = 700, средние заказы/день = 10 → turnover_days = 70 (между 60 и 90)
-- ============================================================
INSERT INTO wb_stocks (barcode, nm_id, warehouse_name, quantity)
VALUES ('TEST-BC-2', 900000002, 'Test WH', 700);

INSERT INTO wb_sales_funnel (nm_id, dt, order_count)
SELECT 900000002, (CURRENT_DATE - g), 10
FROM generate_series(0, 27) AS g;

-- ============================================================
-- SKU C (nm_id 900000003): затоварен, "срочно сливать"
-- stock_qty = 1000, средние заказы/день = 5 → turnover_days = 200 (> 90)
-- ============================================================
INSERT INTO wb_stocks (barcode, nm_id, warehouse_name, quantity)
VALUES ('TEST-BC-3', 900000003, 'Test WH', 1000);

INSERT INTO wb_sales_funnel (nm_id, dt, order_count)
SELECT 900000003, (CURRENT_DATE - g), 5
FROM generate_series(0, 27) AS g;

-- ============================================================
-- SKU D (nm_id 900000004): есть сток, нет продаж — критично
-- ============================================================
INSERT INTO wb_stocks (barcode, nm_id, warehouse_name, quantity)
VALUES ('TEST-BC-4', 900000004, 'Test WH', 50);
-- нет строк в wb_sales_funnel для этого nm_id вообще

-- ============================================================
-- SKU E (nm_id 900000005): нет стока
-- ============================================================
INSERT INTO wb_stocks (barcode, nm_id, warehouse_name, quantity)
VALUES ('TEST-BC-5', 900000005, 'Test WH', 0);

INSERT INTO wb_sales_funnel (nm_id, dt, order_count)
SELECT 900000005, (CURRENT_DATE - g), 3
FROM generate_series(0, 27) AS g;

-- ============================================================
-- ТЕСТЫ
-- ============================================================

-- 1. turnover_days SKU A = 100 / 5 = 20
SELECT is(
  (SELECT turnover_days FROM v_turnover_by_sku WHERE nm_id = 900000001),
  20.0::numeric,
  'Turnover: SKU A turnover_days = 20 (100 сток / 5 заказов в день)'
);

-- 2. recommendation SKU A = норма (turnover_days < 60)
SELECT is(
  (SELECT recommendation FROM v_turnover_by_sku WHERE nm_id = 900000001),
  'норма',
  'Turnover: SKU A (20 дней) → "норма"'
);

-- 3. turnover_days SKU B = 700 / 10 = 70
SELECT is(
  (SELECT turnover_days FROM v_turnover_by_sku WHERE nm_id = 900000002),
  70.0::numeric,
  'Turnover: SKU B turnover_days = 70 (700 сток / 10 заказов в день)'
);

-- 4. recommendation SKU B = акция полезна (60 <= turnover_days <= 90)
SELECT is(
  (SELECT recommendation FROM v_turnover_by_sku WHERE nm_id = 900000002),
  'акция полезна',
  'Turnover: SKU B (70 дней, в диапазоне 60-90) → "акция полезна"'
);

-- 5. turnover_days SKU C = 1000 / 5 = 200
SELECT is(
  (SELECT turnover_days FROM v_turnover_by_sku WHERE nm_id = 900000003),
  200.0::numeric,
  'Turnover: SKU C turnover_days = 200 (1000 сток / 5 заказов в день)'
);

-- 6. recommendation SKU C = срочно сливать (turnover_days > 90)
SELECT is(
  (SELECT recommendation FROM v_turnover_by_sku WHERE nm_id = 900000003),
  'срочно сливать',
  'Turnover: SKU C (200 дней) → "срочно сливать"'
);

-- 7. recommendation SKU D = нет продаж — критично (сток есть, заказов 0/нет строк)
SELECT is(
  (SELECT recommendation FROM v_turnover_by_sku WHERE nm_id = 900000004),
  'нет продаж — критично',
  'Turnover: SKU D (сток 50, нет продаж) → "нет продаж — критично"'
);

-- 8. recommendation SKU E = нет стока (даже при наличии продаж)
SELECT is(
  (SELECT recommendation FROM v_turnover_by_sku WHERE nm_id = 900000005),
  'нет стока',
  'Turnover: SKU E (сток 0, продажи есть) → "нет стока"'
);

SELECT * FROM finish();

ROLLBACK;
