-- COGS по «FIFO по датам» (как в 1С): для каждой продажи берётся себестоимость
-- по sku_cost_history на дату rr_dt (valid_from <= date < COALESCE(valid_to, ∞)).
-- Fallback: sku_catalog.cost_price_rub (если истории нет).
--
-- Это не «партии с qty» FIFO — а FIFO по времени: старая продажа получает старый cost,
-- новая — новый. Как только владелица начнёт добавлять записи cost при каждой поставке —
-- расчёт автоматически станет ближе к 1С без изменения кода.

CREATE OR REPLACE FUNCTION public.cost_at(p_sku_id bigint, p_date date)
 RETURNS numeric
 LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  SELECT COALESCE(
    (SELECT h.cost_rub
       FROM public.sku_cost_history h
       WHERE h.sku_id = p_sku_id
         AND h.valid_from <= p_date
         AND (h.valid_to IS NULL OR h.valid_to > p_date)
       ORDER BY h.valid_from DESC
       LIMIT 1),
    (SELECT s.cost_price_rub FROM public.sku_catalog s WHERE s.id = p_sku_id),
    0
  );
$function$;

-- Пересобираем get_pnl_by_period: cogs теперь через cost_at по каждому rr_dt.
CREATE OR REPLACE FUNCTION public.get_pnl_by_period(p_from date, p_to date)
 RETURNS TABLE(sku_id bigint, my_article text, wb_article bigint, revenue_rub numeric, commission_rub numeric, logistics_rub numeric, penalty_rub numeric, units_sold numeric, cogs_rub numeric, tax_rub numeric, net_profit_rub numeric, margin_pct numeric)
 LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  WITH cogs AS (
    SELECT s.id AS sku_id,
      SUM(public.cost_at(s.id, r.rr_dt::date) *
        CASE WHEN r.doc_type_name = 'Продажа' THEN COALESCE(r.quantity,0)
             WHEN r.doc_type_name = 'Возврат' THEN -COALESCE(r.quantity,0) ELSE 0 END) AS cogs_rub
    FROM public.wb_reports_fact r
    JOIN public.sku_catalog s ON s.wb_article = r.nm_id
    WHERE r.rr_dt::date BETWEEN p_from AND p_to
      AND r.doc_type_name IN ('Продажа','Возврат')
    GROUP BY s.id
  ),
  rev AS (
    SELECT nm_id,
      SUM(CASE WHEN doc_type_name = 'Продажа' THEN COALESCE(retail_price, 0) * COALESCE(quantity, 0)
               WHEN doc_type_name = 'Возврат' THEN -COALESCE(retail_price, 0) * COALESCE(quantity, 0) ELSE 0 END) AS revenue_rub,
      SUM(CASE WHEN doc_type_name = 'Продажа' THEN COALESCE(retail_amount, 0)
               WHEN doc_type_name = 'Возврат' THEN -COALESCE(retail_amount, 0) ELSE 0 END) AS retail_amount_rub,
      SUM(CASE WHEN doc_type_name = 'Продажа' THEN COALESCE(ppvz_for_pay, 0)
               WHEN doc_type_name = 'Возврат' THEN -COALESCE(ppvz_for_pay, 0) ELSE 0 END) AS ppvz_for_pay_rub,
      SUM(CASE WHEN doc_type_name = 'Продажа' THEN COALESCE(quantity, 0)
               WHEN doc_type_name = 'Возврат' THEN -COALESCE(quantity, 0) ELSE 0 END)::NUMERIC AS units_sold
    FROM public.wb_reports_fact
    WHERE rr_dt::date BETWEEN p_from AND p_to AND doc_type_name IN ('Продажа','Возврат')
    GROUP BY nm_id
  ),
  exp AS (
    SELECT nm_id,
      SUM(COALESCE(delivery_rub, 0)) AS logistics_rub,
      SUM(COALESCE(penalty, 0)) AS penalty_rub,
      SUM(COALESCE(storage_fee, 0)) AS storage_rub,
      SUM(COALESCE(deduction, 0)) AS deduction_rub
    FROM public.wb_reports_fact
    WHERE rr_dt::date BETWEEN p_from AND p_to
    GROUP BY nm_id
  ),
  nm_all AS (SELECT nm_id FROM rev UNION SELECT nm_id FROM exp),
  joined AS (
    SELECT s.id AS sku_id, s.my_article, COALESCE(s.wb_article, n.nm_id) AS wb_article,
      COALESCE(rev.revenue_rub, 0) AS revenue_rub,
      COALESCE(rev.retail_amount_rub, 0) AS retail_amount_rub,
      COALESCE(rev.ppvz_for_pay_rub, 0) AS ppvz_for_pay_rub,
      COALESCE(exp.logistics_rub, 0) AS logistics_rub,
      COALESCE(exp.penalty_rub, 0) AS penalty_rub,
      COALESCE(exp.storage_rub, 0) AS storage_rub,
      COALESCE(exp.deduction_rub, 0) AS deduction_rub,
      COALESCE(rev.units_sold, 0) AS units_sold,
      COALESCE(cogs.cogs_rub, 0) AS cogs_rub,
      COALESCE(rev.retail_amount_rub, 0) * 0.06 AS tax_rub
    FROM nm_all n
    LEFT JOIN rev ON rev.nm_id = n.nm_id
    LEFT JOIN exp ON exp.nm_id = n.nm_id
    LEFT JOIN public.sku_catalog s ON s.wb_article = n.nm_id
    LEFT JOIN cogs ON cogs.sku_id = s.id
  )
  SELECT sku_id, my_article, wb_article, revenue_rub,
    revenue_rub - ppvz_for_pay_rub AS commission_rub,
    logistics_rub, penalty_rub, units_sold, cogs_rub, tax_rub,
    ppvz_for_pay_rub - logistics_rub - storage_rub - deduction_rub - penalty_rub - cogs_rub - tax_rub AS net_profit_rub,
    CASE WHEN revenue_rub > 0 THEN
      (ppvz_for_pay_rub - logistics_rub - storage_rub - deduction_rub - penalty_rub - cogs_rub - tax_rub) / revenue_rub * 100
      ELSE 0 END AS margin_pct
  FROM joined;
$function$;
