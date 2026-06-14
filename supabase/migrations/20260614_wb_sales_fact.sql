-- wb_sales_fact — ежедневная детализация продаж/возвратов из Statistics API
-- /api/v1/supplier/sales. Доступна на след. день после продажи (≈30 мин лаг),
-- в отличие от еженедельного финотчёта. Используется для свежих KPI на дашборде
-- и в утреннем брифе. Полная маржа всё равно считается из wb_reports_fact.

CREATE TABLE IF NOT EXISTS wb_sales_fact (
  srid                TEXT PRIMARY KEY,
  sale_id             TEXT,           -- S... = продажа, R... = возврат, D... = другое
  sale_dt             DATE NOT NULL,
  sale_ts             TIMESTAMPTZ,
  last_change_date    TIMESTAMPTZ,
  nm_id               BIGINT,
  barcode             TEXT,
  supplier_article    TEXT,
  tech_size           TEXT,
  brand               TEXT,
  subject             TEXT,
  category            TEXT,
  finished_price      NUMERIC(14,2),  -- цена, которую реально заплатил покупатель
  for_pay             NUMERIC(14,2),  -- к перечислению селлеру (нетто)
  price_with_disc     NUMERIC(14,2),  -- цена с учётом скидки селлера, без SPP
  total_price         NUMERIC(14,2),  -- базовая цена до скидок
  discount_percent    NUMERIC(5,2),
  spp_percent         NUMERIC(5,2),
  is_storno           BOOLEAN NOT NULL DEFAULT false,
  warehouse_name      TEXT,
  office_name         TEXT,
  region_name         TEXT,
  country_name        TEXT,
  raw                 JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_wb_sales_fact_dt ON wb_sales_fact(sale_dt);
CREATE INDEX IF NOT EXISTS ix_wb_sales_fact_nm ON wb_sales_fact(nm_id);
CREATE INDEX IF NOT EXISTS ix_wb_sales_fact_last_change ON wb_sales_fact(last_change_date);

COMMENT ON TABLE wb_sales_fact IS
'Ежедневные продажи/возвраты с Statistics API /sales. По одной строке на единицу. is_storno=true → возврат. Для P&L нужен wb_reports_fact (неделя).';

-- View: дневная сводка продаж (для дашборда «вчера/сегодня»)
CREATE OR REPLACE VIEW v_daily_sales AS
SELECT
  sale_dt,
  COUNT(*) FILTER (WHERE NOT is_storno) AS units_sold,
  COUNT(*) FILTER (WHERE is_storno) AS units_returned,
  COALESCE(SUM(finished_price) FILTER (WHERE NOT is_storno), 0)
    - COALESCE(SUM(finished_price) FILTER (WHERE is_storno), 0) AS revenue_rub,
  COALESCE(SUM(for_pay) FILTER (WHERE NOT is_storno), 0)
    - COALESCE(SUM(for_pay) FILTER (WHERE is_storno), 0) AS payout_rub
FROM wb_sales_fact
GROUP BY sale_dt
ORDER BY sale_dt DESC;

COMMENT ON VIEW v_daily_sales IS
'Дневной агрегат wb_sales_fact: продано/возвращено штук и нетто-выручка.';
