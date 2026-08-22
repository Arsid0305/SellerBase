-- Закрываем 8 таблиц, открытых анониму через PostgREST, и 2 SECURITY DEFINER view.
--
-- Почему безопасно включить RLS без политик: анонимный ключ в приложении
-- используется ТОЛЬКО для аутентификации (login-form, auth/callback, require-auth).
-- Все чтения данных идут server-side через service-role клиент
-- (apps/web/src/shared/lib/supabase/admin.ts), а service_role обходит RLS.
-- Значит «RLS включён, политик нет» = закрыто для всех снаружи, приложение не ломается.

ALTER TABLE public.manual_expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wb_prices_fact           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wb_reviews_fact          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wb_personal_indices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wb_supplies_v2           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wb_supply_items_v2       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_to_wb_invoices  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sku_content_snapshots    ENABLE ROW LEVEL SECURITY;

-- View по умолчанию исполняются с правами владельца (SECURITY DEFINER) и тем самым
-- протаскивают данные мимо RLS базовых таблиц. security_invoker переносит проверку
-- на вызывающего. Обе view читают только таблицы из списка выше.
ALTER VIEW public.v_wb_prices_current       SET (security_invoker = true);
ALTER VIEW public.v_delivery_to_wb_per_unit SET (security_invoker = true);
