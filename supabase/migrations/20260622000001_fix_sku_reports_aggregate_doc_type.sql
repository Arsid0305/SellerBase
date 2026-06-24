-- Fix: get_sku_reports_aggregate расходился с каноном выручки в 25 раз
-- (старая логика считала логистику/хранение/штрафы где quantity > 0 как продажи).
-- Канон везде в репо — doc_type_name IN ('Продажа','Возврат') — см. v_wb_pl_weekly,
-- get_pnl_by_period, get_daily_pnl_series, _daily_pnl_with_cogs.
--
-- Сверка через MCP execute_sql на эталонной неделе 01.12-07.12.2025:
--   старая RPC: 6348 units, 115588.84 ₽
--   новая RPC (canonical): 247 units, 114664.98 ₽
--   эталон владелицы: 246 шт, 114665 ₽ (см. tasks/rules.md §1)
-- Совпадение рубль в рубль.

CREATE OR REPLACE FUNCTION public.get_sku_reports_aggregate(p_from date, p_to date)
RETURNS TABLE (
  nm_id          bigint,
  units_sold     bigint,
  units_returned bigint,
  revenue_rub    numeric,
  last_sale_dt   date
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT
    f.nm_id,
    COALESCE(SUM(CASE WHEN f.doc_type_name = 'Продажа' THEN f.quantity     ELSE 0 END), 0)::bigint  AS units_sold,
    COALESCE(SUM(CASE WHEN f.doc_type_name = 'Возврат' THEN f.quantity     ELSE 0 END), 0)::bigint  AS units_returned,
    COALESCE(
        SUM(CASE WHEN f.doc_type_name = 'Продажа' THEN f.retail_amount ELSE 0 END)
      - SUM(CASE WHEN f.doc_type_name = 'Возврат' THEN f.retail_amount ELSE 0 END),
      0
    )::numeric                                                                                     AS revenue_rub,
    MAX(CASE WHEN f.doc_type_name = 'Продажа' THEN f.rr_dt END)                                    AS last_sale_dt
  FROM public.wb_reports_fact f
  WHERE f.nm_id IS NOT NULL
    AND f.rr_dt BETWEEN p_from AND p_to
    AND f.doc_type_name IN ('Продажа', 'Возврат')
  GROUP BY f.nm_id;
$$;

COMMENT ON FUNCTION public.get_sku_reports_aggregate(date, date) IS
'Агрегат wb_reports_fact по nm_id за период. Фильтр через doc_type_name (канон), не через знак quantity — иначе попадают строки логистики/хранения и завышают units в 20+ раз.';
