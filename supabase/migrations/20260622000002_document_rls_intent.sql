-- Документирует intent RLS для sku_events, wb_ads_fact, wb_orders_fact и др. таблиц
-- которые имеют ENABLE ROW LEVEL SECURITY без CREATE POLICY.
--
-- Текущее состояние: RLS включён, политик нет → доступно ТОЛЬКО через service_role
-- (`createAdminClient` в API routes). Через anon/authenticated keys — 0 rows без ошибки.
--
-- Это намеренно для single-tenant — все мутации идут через API routes которые используют
-- service_role. Когда перейдём на multi-tenant (см. docs/MULTI_TENANT_PLAN.md) — нужны
-- per-organization policies (см. Phase 2 плана).
--
-- COMMENT ON TABLE документирует намерение чтобы будущий разработчик не удивился
-- что RLS enabled без policies.

COMMENT ON TABLE public.sku_events IS
'События по SKU (anomaly detection, lifecycle changes). RLS enabled, policies нет — доступ только через service_role (single-tenant). Multi-tenant TODO: per-org policies.';

COMMENT ON TABLE public.wb_ads_fact IS
'Реклама WB по дням. RLS enabled, policies нет — доступ только через service_role (single-tenant). Multi-tenant TODO: per-org policies.';

COMMENT ON TABLE public.wb_orders_fact IS
'Заказы WB Statistics API. RLS enabled, policies нет — доступ только через service_role (single-tenant). Multi-tenant TODO: per-org policies.';

COMMENT ON TABLE public.wb_sales_fact IS
'Продажи WB Statistics API. RLS enabled, policies нет — доступ только через service_role (single-tenant). Multi-tenant TODO: per-org policies.';

COMMENT ON TABLE public.cargo_tariffs IS
'Тарифы Карго (курс юаня/доллара/доставка 1кг). RLS enabled, policies нет — доступ только через service_role.';
