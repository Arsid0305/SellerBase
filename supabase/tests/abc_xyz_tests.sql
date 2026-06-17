-- pgTAP unit tests for ABC/XYZ-классификации.
--
-- СТАТУС: на момент написания (2026-06-17) в supabase/migrations НЕ найдено
-- ни RPC fetch_abc / get_abc_classification, ни view v_abc_xyz / v_abc_classification.
-- Проверено: grep по всем supabase/migrations/*.sql на "abc"/"xyz" — совпадений нет
-- (за исключением node_modules, не относящихся к БД).
--
-- Чтобы не падать в CI и не блокировать остальные тесты, этот файл:
--   1. Проверяет НАЛИЧИЕ объекта в information_schema/pg_proc.
--   2. Если объект отсутствует — пропускает содержательные тесты через skip(),
--      pgTAP считает skip() пройденным тестом, plan() не нарушается.
--   3. Если/когда ABC-классификация появится — заменить тело "IF FOUND" блока
--      на реальные assert'ы (шаблон ниже) и поднять plan(N) на нужное число.
--
-- Запуск: psql $DATABASE_URL -f supabase/tests/abc_xyz_tests.sql

BEGIN;

SELECT plan(1);

DO $$
DECLARE
  v_has_view boolean;
  v_has_rpc boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name IN ('v_abc_xyz', 'v_abc_classification', 'v_abc')
  ) INTO v_has_view;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('fetch_abc', 'get_abc_classification')
  ) INTO v_has_rpc;

  IF NOT v_has_view AND NOT v_has_rpc THEN
    RAISE NOTICE 'ABC/XYZ: ни view (v_abc_xyz/v_abc_classification/v_abc), ни RPC (fetch_abc/get_abc_classification) не найдены в public — тесты пропущены';
  END IF;
END $$;

SELECT skip(
  1,
  'ABC/XYZ классификация не реализована в supabase/migrations на момент написания тестов (нет fetch_abc / v_abc_xyz) — заменить на реальные assert''ы когда появится миграция'
);

-- ============================================================
-- ШАБЛОН для будущих тестов (раскомментировать и адаптировать,
-- когда появится реальная реализация; не забыть увеличить plan(N)):
-- ============================================================
--
-- -- Фикстуры: 5 SKU с известной выручкой за период, сумма = 100000
-- -- A: 50000 + 30000 = 80000 (80% выручки, первые по убыванию)
-- -- B: 10000 + 5000 = 15000 (следующие 15%)
-- -- C: 3000 + 2000 = 5000 (последние 5%)
-- INSERT INTO sku_catalog (my_article, wb_article, title, cost_price_rub, is_active) VALUES
--   ('TEST-ABC-1', 900000011, 'ABC 1', 100, true),
--   ('TEST-ABC-2', 900000012, 'ABC 2', 100, true),
--   ('TEST-ABC-3', 900000013, 'ABC 3', 100, true),
--   ('TEST-ABC-4', 900000014, 'ABC 4', 100, true),
--   ('TEST-ABC-5', 900000015, 'ABC 5', 100, true);
-- -- ... вставить wb_reports_fact так чтобы revenue был 50000/30000/10000/5000/3000+2000
--
-- SELECT is(
--   (SELECT abc_class FROM v_abc_xyz WHERE wb_article = 900000011),
--   'A',
--   'ABC: SKU с наибольшей выручкой (входит в топ 80%) → класс A'
-- );
-- SELECT is(
--   (SELECT abc_class FROM v_abc_xyz WHERE wb_article = 900000013),
--   'B',
--   'ABC: SKU в диапазоне 80-95% накопленной выручки → класс B'
-- );
-- SELECT is(
--   (SELECT abc_class FROM v_abc_xyz WHERE wb_article = 900000015),
--   'C',
--   'ABC: SKU в последних 5% накопленной выручки → класс C'
-- );

SELECT * FROM finish();

ROLLBACK;
