-- Fix: wb_sales_fact была создана без RLS в 20260614_wb_sales_fact.sql.
-- Любой клиент с anon-ключом мог читать таблицу напрямую через PostgREST.
-- Включаем RLS без policies — доступ остаётся только через service_role (admin client в RSC/edge functions).

ALTER TABLE public.wb_sales_fact ENABLE ROW LEVEL SECURITY;

-- Без policies = ни одной строки не вернётся через anon/authenticated.
-- service_role (используется в createAdminClient + edge functions) bypass'ит RLS — продолжит работать.
