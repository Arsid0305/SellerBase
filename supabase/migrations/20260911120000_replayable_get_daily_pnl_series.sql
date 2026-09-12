-- Финальное состояние get_daily_pnl_series: даёт репозиторию повториться
-- на чистой базе. Найдено аудитом 11.09.2026.
--
-- В чём была беда. Две миграции меняли набор возвращаемых колонок через
-- CREATE OR REPLACE, а Postgres так не умеет: «cannot change return type of
-- existing function». В проде это прошло, потому что функция там
-- пересоздавалась вручную, а при сборке базы с нуля обе миграции падали,
-- и дневной P&L оставался в старой форме.
--
-- Прошлые миграции не трогаем (правило: применённое не правим) — здесь
-- функция сносится и создаётся заново в том виде, в каком она сейчас
-- работает в проде. Определение и набор колонок сверены с прод-базой
-- 11.09.2026 через pg_get_function_result.
-- В прод применять не нужно: там эти объекты уже есть. Файл существует,
-- чтобы база собиралась с нуля — в CI и у любого, кто поднимет копию.


drop function if exists public.get_daily_pnl_series(date, date);

CREATE OR REPLACE FUNCTION public.get_daily_pnl_series(p_from date, p_to date)
RETURNS TABLE(rr_dt date, revenue_rub numeric, commission_rub numeric,
              logistics_rub numeric, storage_rub numeric, acquiring_rub numeric,
              deduction_rub numeric, penalty_rub numeric, cogs_rub numeric,
              tax_rub numeric, net_profit_rub numeric, margin_pct numeric)
LANGUAGE sql STABLE SET search_path TO '' AS $function$
  WITH base AS (
    SELECT
      f.rr_dt::date AS d,
      f.nm_id,
      CASE WHEN f.doc_type_name = 'Продажа' THEN COALESCE(f.retail_price, 0) * COALESCE(f.quantity, 0)
           WHEN f.doc_type_name = 'Возврат' THEN -COALESCE(f.retail_price, 0) * COALESCE(f.quantity, 0)
           ELSE 0 END AS revenue,
      CASE WHEN f.doc_type_name = 'Продажа' THEN COALESCE(f.retail_amount, 0)
           WHEN f.doc_type_name = 'Возврат' THEN -COALESCE(f.retail_amount, 0)
           ELSE 0 END AS retail_amount_net,
      CASE WHEN f.doc_type_name = 'Продажа' THEN COALESCE(f.quantity, 0)
           WHEN f.doc_type_name = 'Возврат' THEN -COALESCE(f.quantity, 0)
           ELSE 0 END AS qty,
      CASE WHEN f.doc_type_name = 'Продажа' THEN COALESCE(f.ppvz_for_pay, 0)
           WHEN f.doc_type_name = 'Возврат' THEN -COALESCE(f.ppvz_for_pay, 0)
           ELSE 0 END AS ppvz,
      COALESCE(f.delivery_rub, 0) AS logistics,
      COALESCE(f.storage_fee, 0) AS storage,
      COALESCE(f.deduction, 0) AS deduction,
      COALESCE(f.penalty, 0) AS penalty,
      CASE WHEN f.doc_type_name IN ('Продажа','Возврат')
           THEN public.cost_at(s.id, f.rr_dt::date) *
                CASE WHEN f.doc_type_name = 'Продажа' THEN COALESCE(f.quantity, 0)
                     ELSE -COALESCE(f.quantity, 0) END
           ELSE 0 END AS cogs
    FROM public.wb_reports_fact f
    LEFT JOIN public.sku_catalog s ON s.wb_article = f.nm_id
    WHERE f.rr_dt::date BETWEEN p_from AND p_to
  ),
  joined AS (
    SELECT d,
      SUM(revenue) AS revenue,
      SUM(retail_amount_net) AS retail_amount_net,
      SUM(ppvz) AS ppvz,
      SUM(logistics) AS logistics,
      SUM(storage) AS storage,
      SUM(deduction) AS deduction,
      SUM(penalty) AS penalty,
      SUM(cogs) AS cogs
    FROM base GROUP BY d
  )
  SELECT
    j.d AS rr_dt,
    j.revenue AS revenue_rub,
    (j.revenue - j.ppvz) AS commission_rub,
    j.logistics AS logistics_rub,
    j.storage AS storage_rub,
    -- Эквайринг уже удержан WB внутри ppvz_for_pay: см. пункт 2 в шапке.
    0::numeric AS acquiring_rub,
    j.deduction AS deduction_rub,
    j.penalty AS penalty_rub,
    j.cogs AS cogs_rub,
    (j.retail_amount_net * public.app_setting_num('tax_rate')) AS tax_rub,
    (j.ppvz - j.logistics - j.storage - j.deduction - j.penalty - j.cogs
      - j.retail_amount_net * public.app_setting_num('tax_rate')) AS net_profit_rub,
    CASE WHEN j.revenue > 0 THEN
      (j.ppvz - j.logistics - j.storage - j.deduction - j.penalty - j.cogs
        - j.retail_amount_net * public.app_setting_num('tax_rate')) / j.revenue * 100
      ELSE 0 END AS margin_pct
  FROM joined j
  ORDER BY j.d;
$function$;

comment on function public.get_daily_pnl_series(date, date) is
  'Дневной P&L. Состав расходов совпадает с get_pnl_by_period и с отчётом WB: комиссия (revenue - ppvz), логистика по delivery_rub, хранение, удержания, штрафы, себестоимость по cost_at на дату продажи, налог от retail_amount. Эквайринг в acquiring_rub всегда 0 - он уже внутри ppvz. Возмещение издержек по перевозке (rebill_logistic_cost) в расход не идёт.';
