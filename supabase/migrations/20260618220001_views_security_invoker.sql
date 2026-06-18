-- Перевести 4 view из SECURITY DEFINER в SECURITY INVOKER.
-- Совет Supabase advisor (ERROR-уровень): SECURITY DEFINER view применяет права создателя, обходя RLS вызывающего.
-- Все 4 view используются только из server-side (admin client с service_role), поэтому переход безопасен —
-- service_role уже bypass'ит RLS, эффект одинаковый.

ALTER VIEW public.v_sku_lifecycle SET (security_invoker = true);
ALTER VIEW public.v_supply_recommendation SET (security_invoker = true);
ALTER VIEW public.v_sku_snapshot_diffs SET (security_invoker = true);
ALTER VIEW public.v_daily_sales SET (security_invoker = true);
