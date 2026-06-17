-- pgTAP unit tests for P&L RPCs: get_pnl_by_period, get_daily_pnl_series.
--
-- Запуск: psql $DATABASE_URL -f supabase/tests/pnl_tests.sql
-- Требует: расширение pgtap (CREATE EXTENSION IF NOT EXISTS pgtap;)
--
-- Тесты вставляют фикстуры НАПРЯМУЮ в реальные таблицы sku_catalog / wb_reports_fact
-- (RPC не параметризуемы по схеме — SET search_path TO ''), но всё происходит внутри
-- BEGIN...ROLLBACK, поэтому в базе ничего не остаётся.
--
-- Тестовые SKU используют wb_article в диапазоне 900000001-900000099, чтобы не
-- пересекаться с реальными данными и чтобы можно было WHERE-фильтровать результат RPC.

BEGIN;

SELECT plan(14);

-- ============================================================
-- Сетап: tax_rate детерминирован для теста (не зависит от прод-настройки)
-- ============================================================
UPDATE app_settings SET value = '0.06' WHERE key = 'tax_rate';
-- Если строки tax_rate в app_settings ещё нет (пустая база) — создать.
INSERT INTO app_settings (key, value, value_type, comment)
SELECT 'tax_rate', '0.06', 'number', 'test override'
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'tax_rate');

-- ============================================================
-- Фикстуры: 2 тестовых SKU
-- ============================================================

-- SKU#1: wb_article 900000001, cost_price_rub = 500
INSERT INTO sku_catalog (my_article, wb_article, title, cost_price_rub, is_active)
VALUES ('TEST-SKU-1', 900000001, 'Test SKU 1', 500, true);

-- SKU#2: wb_article 900000002, cost_price_rub = 200
INSERT INTO sku_catalog (my_article, wb_article, title, cost_price_rub, is_active)
VALUES ('TEST-SKU-2', 900000002, 'Test SKU 2', 200, true);

-- ---------------------------------------------------------------
-- SKU#1: 5 продаж по retail_price=2000, quantity=1 → revenue (R14) = 5 × 2000 = 10000
-- ppvz_for_pay = 1700 за продажу (эффективная комиссия 300/шт = 1500 всего)
-- logistics = 50/шт = 250, storage = 20/шт = 100, acquiring = 10/шт = 50, penalty = 0
-- cogs = 500 × 5 = 2500
-- tax = 10000 × 0.06 = 600
-- net_profit = ppvz_total(8500) - logistics(250) - storage(100) - acquiring(50)
--              - deduction(0) - penalty(0) - cogs(2500) - tax(600) = 5000
-- margin_pct = 5000 / 10000 * 100 = 50%
-- ---------------------------------------------------------------
INSERT INTO wb_reports_fact (
  rrd_id, srid, nm_id, doc_type_name, sale_dt, rr_dt,
  quantity, retail_price, retail_amount, ppvz_for_pay,
  delivery_rub, storage_fee, acquiring_fee, deduction, rebill_logistic_cost, penalty
)
SELECT
  900000001000 + g, 'TEST-SRID-1-' || g, 900000001, 'Продажа',
  '2026-06-10'::timestamptz, '2026-06-10'::date,
  1, 2000, 1700, 1700,
  50, 20, 10, 0, 0, 0
FROM generate_series(1, 5) AS g;

-- ---------------------------------------------------------------
-- SKU#2: 3 продажи по retail_price=1000, quantity=2 → revenue = 3 × (1000*2) = 6000
-- + 1 возврат retail_amount = 1500, quantity = 1 → revenue -= 1500 → revenue = 4500
-- units_sold = 3*2 - 1 = 5
-- ppvz_for_pay по продажам = 800*3=2400, возврат не несёт ppvz (rr_dt тот же диапазон, ppvz=0)
-- ---------------------------------------------------------------
INSERT INTO wb_reports_fact (
  rrd_id, srid, nm_id, doc_type_name, sale_dt, rr_dt,
  quantity, retail_price, retail_amount, ppvz_for_pay,
  delivery_rub, storage_fee, acquiring_fee, deduction, rebill_logistic_cost, penalty
)
SELECT
  900000002000 + g, 'TEST-SRID-2-' || g, 900000002, 'Продажа',
  '2026-06-11'::timestamptz, '2026-06-11'::date,
  2, 1000, 1600, 800,
  30, 10, 5, 0, 0, 0
FROM generate_series(1, 3) AS g;

INSERT INTO wb_reports_fact (
  rrd_id, srid, nm_id, doc_type_name, sale_dt, rr_dt,
  quantity, retail_price, retail_amount, ppvz_for_pay,
  delivery_rub, storage_fee, acquiring_fee, deduction, rebill_logistic_cost, penalty
)
VALUES (
  900000002999, 'TEST-SRID-2-RETURN', 900000002, 'Возврат',
  '2026-06-12'::timestamptz, '2026-06-12'::date,
  1, 1000, 1500, 0,
  0, 0, 0, 0, 0, 0
);

-- ============================================================
-- ТЕСТЫ: get_pnl_by_period
-- ============================================================

-- 1. Revenue SKU#1: R14 формула = retail_price × quantity (продажи), без возвратов = 10000
SELECT is(
  (SELECT revenue_rub FROM get_pnl_by_period('2026-06-01', '2026-06-30') WHERE wb_article = 900000001),
  10000::numeric,
  'P&L: revenue_rub SKU#1 = 10000 (5 продаж × 2000₽ по retail_price)'
);

-- 2. Revenue SKU#2: 3 продажи × (1000×2=2000) − возврат retail_amount 1500 = 6000 - 1500 = 4500
SELECT is(
  (SELECT revenue_rub FROM get_pnl_by_period('2026-06-01', '2026-06-30') WHERE wb_article = 900000002),
  4500::numeric,
  'P&L: revenue_rub SKU#2 = 4500 (3×2000 продажи − 1500 возврат)'
);

-- 3. units_sold SKU#2 = 3×2 - 1 = 5 (возврат уменьшает количество)
SELECT is(
  (SELECT units_sold FROM get_pnl_by_period('2026-06-01', '2026-06-30') WHERE wb_article = 900000002),
  5::numeric,
  'P&L: units_sold SKU#2 = 5 (6 продано − 1 возврат)'
);

-- 4. cogs_rub SKU#1 = cost_price_rub(500) × units_sold(5) = 2500
SELECT is(
  (SELECT cogs_rub FROM get_pnl_by_period('2026-06-01', '2026-06-30') WHERE wb_article = 900000001),
  2500::numeric,
  'P&L: cogs_rub SKU#1 = 2500 (500₽/шт × 5шт)'
);

-- 5. tax_rub SKU#1 = revenue(10000) × tax_rate(0.06) = 600
SELECT is(
  (SELECT tax_rub FROM get_pnl_by_period('2026-06-01', '2026-06-30') WHERE wb_article = 900000001),
  600::numeric,
  'P&L: tax_rub SKU#1 = 600 (10000 × 6%)'
);

-- 6. commission_rub SKU#1 = revenue(10000) − ppvz_for_pay_total(8500) = 1500
SELECT is(
  (SELECT commission_rub FROM get_pnl_by_period('2026-06-01', '2026-06-30') WHERE wb_article = 900000001),
  1500::numeric,
  'P&L: commission_rub SKU#1 = 1500 (revenue − ppvz_for_pay)'
);

-- 7. net_profit_rub SKU#1 = ppvz(8500) - logistics(250) - storage(100) - acquiring(50)
--    - deduction(0) - penalty(0) - cogs(2500) - tax(600) = 5000
SELECT is(
  (SELECT net_profit_rub FROM get_pnl_by_period('2026-06-01', '2026-06-30') WHERE wb_article = 900000001),
  5000::numeric,
  'P&L: net_profit_rub SKU#1 = 5000 = ppvz − logistics − storage − acquiring − cogs − tax'
);

-- 8. margin_pct SKU#1 = 5000 / 10000 × 100 = 50
SELECT is(
  (SELECT margin_pct FROM get_pnl_by_period('2026-06-01', '2026-06-30') WHERE wb_article = 900000001),
  50::numeric,
  'P&L: margin_pct SKU#1 = 50%'
);

-- 9. margin_pct формула непротиворечива: profit/revenue*100 для произвольной строки SKU#2
SELECT ok(
  (SELECT ABS(margin_pct - net_profit_rub / revenue_rub * 100) < 0.0001
     FROM get_pnl_by_period('2026-06-01', '2026-06-30') WHERE wb_article = 900000002),
  'P&L: margin_pct SKU#2 согласован с net_profit_rub / revenue_rub × 100'
);

-- 10. Период вне диапазона дат → SKU не должен попадать в выборку вообще
SELECT is(
  (SELECT COUNT(*)::int FROM get_pnl_by_period('2025-01-01', '2025-01-31') WHERE wb_article IN (900000001, 900000002)),
  0,
  'P&L: тестовые SKU отсутствуют в выборке за период без продаж'
);

-- ============================================================
-- ТЕСТЫ: get_daily_pnl_series — нет дублей по дням, сумма корректна
-- ============================================================

-- 11. Ровно одна строка на дату 2026-06-10 (SKU#1), без дублирования
SELECT is(
  (SELECT COUNT(*)::int FROM get_daily_pnl_series('2026-06-01', '2026-06-30') WHERE rr_dt = '2026-06-10'),
  1,
  'Daily P&L: ровно 1 агрегированная строка на 2026-06-10 (нет дублей)'
);

-- 12. Уникальность rr_dt по всей выдаче за период (нет повторяющихся дней вообще)
SELECT is(
  (SELECT COUNT(*)::int FROM get_daily_pnl_series('2026-06-01', '2026-06-30')),
  (SELECT COUNT(DISTINCT rr_dt)::int FROM get_daily_pnl_series('2026-06-01', '2026-06-30')),
  'Daily P&L: количество строк = количеству уникальных дат (нет дублей)'
);

-- 13. revenue_rub за 2026-06-10 включает ровно вклад SKU#1 (другие SKU в БД не должны искажать
--     наш тестовый день сильнее, чем на сумму своих собственных продаж — проверяем нижнюю границу)
SELECT cmp_ok(
  (SELECT revenue_rub FROM get_daily_pnl_series('2026-06-01', '2026-06-30') WHERE rr_dt = '2026-06-10'),
  '>=',
  10000::numeric,
  'Daily P&L: revenue_rub за 2026-06-10 >= вклад SKU#1 (10000)'
);

-- 14. Сумма revenue_rub по дням за период >= сумме revenue_rub по SKU за тот же период
--     (агрегация по дате не теряет данные по сравнению с агрегацией по SKU)
SELECT cmp_ok(
  (SELECT COALESCE(SUM(revenue_rub), 0) FROM get_daily_pnl_series('2026-06-10', '2026-06-12')),
  '>=',
  (SELECT COALESCE(SUM(revenue_rub), 0) FROM get_pnl_by_period('2026-06-10', '2026-06-12')
     WHERE wb_article IN (900000001, 900000002)),
  'Daily P&L: сумма выручки по дням >= сумме выручки тестовых SKU за тот же период'
);

SELECT * FROM finish();

ROLLBACK;
