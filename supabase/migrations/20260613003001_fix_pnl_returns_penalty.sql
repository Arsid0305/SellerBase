-- Fix #1 (Gemini audit, HIGH): get_pnl_by_period не вычитал штрафы из net_profit
-- и не учитывал возвраты в выручке. TS-графики (fetchDailyMarginSeries) при этом
-- штрафы вычитали — рассинхрон между таблицей и графиком.
--
-- Изменения:
--   revenue_rub  = SUM(retail_amount) Продажи − SUM(retail_amount) Возвраты
--   penalty_rub  — новая колонка в результате
--   net_profit  -= penalty
--   units_sold   уменьшается на возвраты (для корректного COGS)
--
-- Fix #2 (Gemini audit, HIGH): добавлена RPC get_daily_pnl_series для
-- агрегации по дням на стороне БД — TS больше не тянет 100k строк в Node.

DROP FUNCTION IF EXISTS get_full_pnl_by_period(DATE, DATE);
DROP FUNCTION IF EXISTS get_pnl_by_period(DATE, DATE);

CREATE OR REPLACE FUNCTION get_pnl_by_period(p_from DATE, p_to DATE)
RETURNS TABLE (
  sku_id           BIGINT,
  my_article       TEXT,
  wb_article       BIGINT,
  revenue_rub      NUMERIC,
  commission_rub   NUMERIC,
  logistics_rub    NUMERIC,
  penalty_rub      NUMERIC,
  units_sold       NUMERIC,
  cogs_rub         NUMERIC,
  tax_rub          NUMERIC,
  net_profit_rub   NUMERIC,
  margin_pct       NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH rev AS (
    SELECT
      nm_id,
      SUM(
        CASE
          WHEN doc_type_name = 'Продажа' THEN COALESCE(retail_amount, 0)
          WHEN doc_type_name = 'Возврат' THEN -COALESCE(retail_amount, 0)
          ELSE 0
        END
      ) AS revenue_rub,
      SUM(
        CASE
          WHEN doc_type_name = 'Продажа' THEN COALESCE(quantity, 0)
          WHEN doc_type_name = 'Возврат' THEN -COALESCE(quantity, 0)
          ELSE 0
        END
      )::NUMERIC AS units_sold
    FROM public.wb_reports_fact
    WHERE sale_dt::date BETWEEN p_from AND p_to
    GROUP BY nm_id
  ),
  com AS (
    SELECT nm_id, SUM(COALESCE(commission_rub, 0)) AS commission_rub
    FROM public.wb_reports_fact
    WHERE rr_dt::date BETWEEN p_from AND p_to
    GROUP BY nm_id
  ),
  log AS (
    SELECT nm_id, SUM(COALESCE(delivery_rub, 0)) AS logistics_rub
    FROM public.wb_reports_fact
    WHERE rr_dt::date BETWEEN p_from AND p_to
    GROUP BY nm_id
  ),
  pen AS (
    SELECT nm_id, SUM(COALESCE(penalty, 0)) AS penalty_rub
    FROM public.wb_reports_fact
    WHERE rr_dt::date BETWEEN p_from AND p_to
    GROUP BY nm_id
  )
  SELECT
    s.id AS sku_id,
    s.my_article,
    s.wb_article,
    COALESCE(rev.revenue_rub, 0) AS revenue_rub,
    COALESCE(com.commission_rub, 0) AS commission_rub,
    COALESCE(log.logistics_rub, 0) AS logistics_rub,
    COALESCE(pen.penalty_rub, 0) AS penalty_rub,
    COALESCE(rev.units_sold, 0) AS units_sold,
    COALESCE(s.cost_price_rub, 0) * GREATEST(COALESCE(rev.units_sold, 0), 0) AS cogs_rub,
    COALESCE(rev.revenue_rub, 0) * public.app_setting_num('tax_rate') AS tax_rub,
    COALESCE(rev.revenue_rub, 0)
      - COALESCE(com.commission_rub, 0)
      - COALESCE(log.logistics_rub, 0)
      - COALESCE(pen.penalty_rub, 0)
      - COALESCE(s.cost_price_rub, 0) * GREATEST(COALESCE(rev.units_sold, 0), 0)
      - COALESCE(rev.revenue_rub, 0) * public.app_setting_num('tax_rate') AS net_profit_rub,
    CASE WHEN COALESCE(rev.revenue_rub, 0) > 0 THEN
      (
        COALESCE(rev.revenue_rub, 0)
        - COALESCE(com.commission_rub, 0)
        - COALESCE(log.logistics_rub, 0)
        - COALESCE(pen.penalty_rub, 0)
        - COALESCE(s.cost_price_rub, 0) * GREATEST(COALESCE(rev.units_sold, 0), 0)
        - COALESCE(rev.revenue_rub, 0) * public.app_setting_num('tax_rate')
      ) / COALESCE(rev.revenue_rub, 0) * 100
      ELSE 0
    END AS margin_pct
  FROM public.sku_catalog s
  LEFT JOIN rev ON rev.nm_id = s.wb_article
  LEFT JOIN com ON com.nm_id = s.wb_article
  LEFT JOIN log ON log.nm_id = s.wb_article
  LEFT JOIN pen ON pen.nm_id = s.wb_article
  WHERE COALESCE(rev.revenue_rub, 0) > 0
     OR COALESCE(com.commission_rub, 0) > 0
     OR COALESCE(log.logistics_rub, 0) > 0
     OR COALESCE(pen.penalty_rub, 0) > 0;
$$;

COMMENT ON FUNCTION get_pnl_by_period(date, date) IS
'P&L по SKU за период. Выручка = Продажи − Возвраты по retail_amount.
Прибыль = Выручка − Комиссия − Логистика − Штрафы − COGS − Налог.
Margin = Прибыль / Выручка.';

-- get_full_pnl_by_period (0011) добавляет marketing — он автоматически подхватит penalty,
-- т.к. ниже мы синхронизируем сигнатуру.

CREATE OR REPLACE FUNCTION get_full_pnl_by_period(p_from DATE, p_to DATE)
RETURNS TABLE (
  sku_id            BIGINT,
  my_article        TEXT,
  wb_article        BIGINT,
  revenue_rub       NUMERIC,
  commission_rub    NUMERIC,
  logistics_rub     NUMERIC,
  penalty_rub       NUMERIC,
  units_sold        NUMERIC,
  cogs_rub          NUMERIC,
  tax_rub           NUMERIC,
  marketing_rub     NUMERIC,
  net_profit_rub    NUMERIC,
  margin_pct        NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH pnl AS (
    SELECT * FROM public.get_pnl_by_period(p_from, p_to)
  ),
  mkt AS (
    SELECT sku_id, SUM(COALESCE(amount_rub, 0)) AS marketing_rub
    FROM public.marketing_expenses
    WHERE expense_dt BETWEEN p_from AND p_to
      AND sku_id IS NOT NULL
    GROUP BY sku_id
  )
  SELECT
    pnl.sku_id,
    pnl.my_article,
    pnl.wb_article,
    pnl.revenue_rub,
    pnl.commission_rub,
    pnl.logistics_rub,
    pnl.penalty_rub,
    pnl.units_sold,
    pnl.cogs_rub,
    pnl.tax_rub,
    COALESCE(mkt.marketing_rub, 0) AS marketing_rub,
    pnl.net_profit_rub - COALESCE(mkt.marketing_rub, 0) AS net_profit_rub,
    CASE WHEN pnl.revenue_rub > 0 THEN
      (pnl.net_profit_rub - COALESCE(mkt.marketing_rub, 0)) / pnl.revenue_rub * 100
      ELSE 0
    END AS margin_pct
  FROM pnl
  LEFT JOIN mkt ON mkt.sku_id = pnl.sku_id;
$$;

COMMENT ON FUNCTION get_full_pnl_by_period(date, date) IS
'P&L по SKU с учётом внешнего маркетинга (marketing_expenses) и штрафов.';

-- Fix #2: дневной агрегат в БД, чтобы не тянуть 100k строк в Node для графиков.
CREATE OR REPLACE FUNCTION get_daily_pnl_series(p_from DATE, p_to DATE)
RETURNS TABLE (
  rr_dt           DATE,
  revenue_rub     NUMERIC,
  commission_rub  NUMERIC,
  logistics_rub   NUMERIC,
  penalty_rub     NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    rr_dt::date AS rr_dt,
    SUM(
      CASE
        WHEN doc_type_name = 'Продажа' THEN COALESCE(retail_amount, 0)
        WHEN doc_type_name = 'Возврат' THEN -COALESCE(retail_amount, 0)
        ELSE 0
      END
    ) AS revenue_rub,
    SUM(COALESCE(commission_rub, 0)) AS commission_rub,
    SUM(COALESCE(delivery_rub, 0)) AS logistics_rub,
    SUM(COALESCE(penalty, 0)) AS penalty_rub
  FROM public.wb_reports_fact
  WHERE rr_dt::date BETWEEN p_from AND p_to
  GROUP BY rr_dt::date
  ORDER BY rr_dt::date;
$$;

COMMENT ON FUNCTION get_daily_pnl_series(date, date) IS
'Дневной агрегат P&L (выручка/комиссия/логистика/штрафы) для графиков.
Заменяет range(0, 100000) клиентскую агрегацию в TS.';
