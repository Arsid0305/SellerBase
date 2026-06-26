-- Доход = моя цена в карточке × количество. Та же логика что в get_pnl_by_period.
-- profit/cost тоже считаются от retail_price * quantity, не от retail_amount.

CREATE OR REPLACE FUNCTION public.get_catalog_sales_daily(p_since date, p_nm_ids bigint[])
 RETURNS TABLE(nm_id bigint, rr_dt date, revenue numeric, units numeric, profit numeric, cost numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  WITH cur_cost AS (
    SELECT
      s.wb_article AS nm_id,
      COALESCE(
        (SELECT h.cost_rub
         FROM public.sku_cost_history h
         WHERE h.sku_id = s.id AND h.valid_to IS NULL
         ORDER BY h.valid_from DESC
         LIMIT 1),
        s.cost_price_rub,
        0
      )::numeric AS cost_per_unit
    FROM public.sku_catalog s
    WHERE s.wb_article = ANY(p_nm_ids)
  )
  SELECT
    f.nm_id,
    f.rr_dt,
    SUM(COALESCE(f.retail_price, 0) * COALESCE(f.quantity, 0))::numeric AS revenue,
    SUM(f.quantity)::numeric AS units,
    SUM(
      COALESCE(f.retail_price, 0) * COALESCE(f.quantity, 0)
      - COALESCE(f.commission_rub, 0)
      - COALESCE(f.delivery_rub, 0)
      - COALESCE(f.penalty, 0)
      - f.quantity * COALESCE(cc.cost_per_unit, 0)
      - COALESCE(f.retail_price, 0) * COALESCE(f.quantity, 0) * 0.06
    )::numeric AS profit,
    SUM(
      COALESCE(f.commission_rub, 0)
      + COALESCE(f.delivery_rub, 0)
      + COALESCE(f.penalty, 0)
      + f.quantity * COALESCE(cc.cost_per_unit, 0)
      + COALESCE(f.retail_price, 0) * COALESCE(f.quantity, 0) * 0.06
    )::numeric AS cost
  FROM public.wb_reports_fact f
  LEFT JOIN cur_cost cc ON cc.nm_id = f.nm_id
  WHERE f.rr_dt >= p_since
    AND f.nm_id = ANY(p_nm_ids)
    AND f.doc_type_name IN ('Продажа', 'Возврат')
  GROUP BY f.nm_id, f.rr_dt;
$function$;
