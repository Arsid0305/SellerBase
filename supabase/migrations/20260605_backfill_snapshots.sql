-- One-time backfill миграция: заполняет sku_snapshots за последние 30 дней.
-- Источники: текущее состояние sku_catalog + средние цены из wb_reports_fact (7-дневное окно).
-- После применения ежедневное обновление выполняет Edge Function `snapshot_catalog`.
-- Повторный запуск безопасен: ON CONFLICT (sku_id, snapshot_date) DO NOTHING.

-- Backfill sku_snapshots за последние 30 дней:
-- - title/brand/category берём из текущего sku_catalog (за 30 дней вряд ли менялись)
-- - price_rub считаем как средняя retail_amount/quantity за 7 дней до snapshot_date
-- - rating/reviews_count = NULL (нет источника на этом этапе)
-- - is_active = текущее
-- - UPSERT по (sku_id, snapshot_date) с ON CONFLICT DO NOTHING

INSERT INTO sku_snapshots (sku_id, snapshot_date, title, brand, category, price_rub, rating, reviews_count, is_active, raw)
SELECT
  c.id AS sku_id,
  d.snapshot_date,
  c.title,
  c.brand,
  c.category,
  (
    SELECT ROUND(AVG(NULLIF(f.retail_amount, 0) / NULLIF(f.quantity, 0))::numeric, 2)
    FROM wb_reports_fact f
    WHERE f.nm_id = c.wb_article
      AND f.quantity > 0
      AND f.rr_dt >= d.snapshot_date - INTERVAL '7 days'
      AND f.rr_dt <= d.snapshot_date
  ) AS price_rub,
  NULL::numeric AS rating,
  NULL::int AS reviews_count,
  c.is_active,
  jsonb_build_object('source', 'backfill', 'cost_price_rub', c.cost_price_rub) AS raw
FROM sku_catalog c
CROSS JOIN (
  SELECT (CURRENT_DATE - n)::date AS snapshot_date
  FROM generate_series(0, 29) n
) d
WHERE c.is_active = true
  AND c.wb_article IS NOT NULL
ON CONFLICT (sku_id, snapshot_date) DO NOTHING;

-- Информационный SELECT (для подтверждения после применения):
-- SELECT COUNT(*) FROM sku_snapshots WHERE raw->>'source' = 'backfill';
