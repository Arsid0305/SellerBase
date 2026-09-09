-- Дневной P&L приведён к периодному — решение по итогам разбора 05.09.2026.
--
-- Расхождение было 49 499 ₽ на одной неделе: get_pnl_by_period давал 74 067 ₽
-- прибыли, get_daily_pnl_series — 24 569 ₽. Разобрано по строкам, эталон —
-- «Итого к оплате» из WB-скрина в tasks/rules.md §1:
--
--   117 532,42 (к перечислению) − 18 495,37 (логистика) − 6 021,16 (хранение)
--   = 93 015,89 ₽ — сходится с кабинетом до копейки.
--
-- Отсюда четыре правки дневного расчёта:
--
-- 1. ЛОГИСТИКА — только delivery_rub. Прежде прибавлялся rebill_logistic_cost:
--    26 132,70 ₽ за неделю по 3 050 строкам операции «Возмещение издержек
--    по перевозке/по складским операциям с товаром». В «Итого к оплате» эта
--    сумма не входит — расчёт сходится без неё.
--
-- 2. ЭКВАЙРИНГ — не вычитается. WB удерживает его до перечисления, он уже
--    внутри ppvz_for_pay, то есть внутри «комиссии» (revenue − ppvz). Вычитание
--    второй раз задваивало 3 152,11 ₽. Колонка acquiring_rub оставлена в выдаче
--    ради совместимости с фронтом (`fetchDailyRevenue` читает 12 полей и
--    складывает их в расходы), но возвращает 0 — иначе интерфейс задвоит сам.
--
-- 3. СЕБЕСТОИМОСТЬ — cost_at(sku, дата продажи) вместо сегодняшней
--    sku_catalog.cost_price_rub. Прежде к декабрьским продажам применялась
--    сентябрьская цена: 29 769 ₽ вместо 12 069 ₽. Пропусков в FIFO-истории нет,
--    проверено: ноль SKU без цены на дату.
--
-- 4. НАЛОГ — от retail_amount (то, что заплатили покупатели), а не от выручки
--    по цене карточки. Прежде: 170 934 × 6 % = 10 256 ₽ вместо 114 665 × 6 %
--    = 6 880 ₽. Цена по карточке — до скидки WB, этих денег продавец не видел.
--
-- Выручка тоже приведена к канону: возврат вычитается по retail_price × qty,
-- как в периодном расчёте и как в эталоне недели (170 767,86 ₽).
--
-- Заодно периодный расчёт перестаёт хардкодить ставку налога: берёт
-- app_setting_num('tax_rate'). Сейчас там 0.06 — цифры не меняются, но ставка
-- становится управляемой из настроек, а не из тела функции.

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

COMMENT ON FUNCTION public.get_daily_pnl_series(date, date) IS
  'Дневной P&L. Состав расходов совпадает с get_pnl_by_period и с отчётом WB: комиссия (revenue − ppvz), логистика по delivery_rub, хранение, удержания, штрафы, себестоимость по cost_at на дату продажи, налог от retail_amount. Эквайринг в acquiring_rub всегда 0 — он уже внутри ppvz. Возмещение издержек по перевозке (rebill_logistic_cost) в расход не идёт: «Итого к оплате» WB сходится без него.';
