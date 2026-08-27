-- Advisor: Security Definer View (critical).
-- View по умолчанию выполняется с правами создателя и обходит RLS нижележащих таблиц.
-- security_invoker = on — запрос идёт с правами вызывающей роли, RLS wb_serp_snapshots
-- и sku_catalog применяется как надо.
-- Применена через MCP apply_migration 2026-08-27, advisor после неё чист.

alter view public.v_serp_snapshots set (security_invoker = on);
