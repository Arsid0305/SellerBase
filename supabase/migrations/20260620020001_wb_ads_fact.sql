-- wb_ads_fact — дневная статистика рекламных кампаний WB Advert API.
-- Источник: POST https://advert-api.wildberries.ru/adv/v2/fullstats
-- Список кампаний: GET https://advert-api.wildberries.ru/adv/v1/promotion/count
-- Используется для вкладки «Продвижение» на дашборде и для реального
-- маркетинга в P&L (см. fetch-wb-ads).

CREATE TABLE IF NOT EXISTS wb_ads_fact (
  campaign_id     BIGINT NOT NULL,
  date            DATE NOT NULL,
  nm_id           BIGINT,            -- может быть NULL для агрегатов по кампании
  nm_id_key       BIGINT GENERATED ALWAYS AS (COALESCE(nm_id, 0)) STORED,
  campaign_name   TEXT,
  views           BIGINT DEFAULT 0,
  clicks          BIGINT DEFAULT 0,
  ctr             NUMERIC(8,4),       -- click-through-rate %
  cpc_rub         NUMERIC(10,4),      -- cost per click ₽
  spend_rub       NUMERIC(14,2) NOT NULL DEFAULT 0,
  orders_count    INTEGER DEFAULT 0,
  orders_sum_rub  NUMERIC(14,2),
  shks            INTEGER DEFAULT 0,  -- единиц
  type            INTEGER,            -- тип кампании: 4=каталог, 5=поиск, 6=карточка, 7=рекомендации, 8=автоматическая, 9=аукцион
  status          INTEGER,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, date, nm_id_key)
);

CREATE INDEX IF NOT EXISTS ix_wb_ads_fact_date ON wb_ads_fact(date);
CREATE INDEX IF NOT EXISTS ix_wb_ads_fact_nm ON wb_ads_fact(nm_id);

ALTER TABLE wb_ads_fact ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE wb_ads_fact IS
'Дневная статистика рекламных кампаний WB Advert API (fullstats). По одной строке на (campaign_id, date, nm_id). nm_id NULL = агрегат по кампании без детализации по товару.';

-- View: расходы на маркетинг по дням
CREATE OR REPLACE VIEW v_daily_marketing_spend
WITH (security_invoker = true)
AS
SELECT
  date,
  SUM(spend_rub) AS spend_rub,
  SUM(views) AS views,
  SUM(clicks) AS clicks,
  SUM(orders_count) AS orders,
  SUM(orders_sum_rub) AS orders_rub
FROM wb_ads_fact
GROUP BY date;

COMMENT ON VIEW v_daily_marketing_spend IS
'Дневной агрегат расходов на рекламу WB (wb_ads_fact). Источник реального маркетинга для P&L.';

-- RPC для часовой агрегации (для WbStyleChart, вкладка «Продвижение»)
CREATE OR REPLACE FUNCTION get_ads_hourly(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (
  hour timestamptz,
  spend_rub numeric,
  clicks bigint,
  orders bigint
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT
    DATE_TRUNC('hour', date::timestamptz) AS hour,
    SUM(spend_rub) AS spend_rub,
    SUM(clicks) AS clicks,
    SUM(orders_count) AS orders
  FROM wb_ads_fact
  WHERE date >= p_from::date AND date <= p_to::date
  GROUP BY hour
  ORDER BY hour;
$$;

COMMENT ON FUNCTION get_ads_hourly(timestamptz, timestamptz) IS
'Почасовая агрегация расходов на рекламу. Данные wb_ads_fact дневные — каждый день размазывается в одну часовую точку (00:00 дня). Используется для WB-style графика, вкладка «Продвижение».';

-- RPC: суммарный реальный маркетинг WB за период (для P&L)
CREATE OR REPLACE FUNCTION get_real_marketing_for_period(p_from date, p_to date)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(SUM(spend_rub), 0)
  FROM wb_ads_fact
  WHERE date >= p_from AND date <= p_to;
$$;

COMMENT ON FUNCTION get_real_marketing_for_period(date, date) IS
'Сумма реальных расходов на рекламу WB (wb_ads_fact) за период. Используется в P&L как дополнение к marketing_expenses (внешний маркетинг).';
