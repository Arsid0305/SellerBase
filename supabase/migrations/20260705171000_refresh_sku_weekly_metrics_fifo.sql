-- refresh_sku_weekly_metrics: cost_sold_total и net_profit через cost_at() (FIFO по датам).

CREATE OR REPLACE FUNCTION public.refresh_sku_weekly_metrics(p_year int)
 RETURNS TABLE(rows_written int) LANGUAGE plpgsql SET search_path TO ''
AS $function$
DECLARE v_count int;
BEGIN
  DELETE FROM public.sku_weekly_metrics WHERE year = p_year;

  INSERT INTO public.sku_weekly_metrics (
    sku_id, wb_article, barcode, year, week_num, cost_per_unit,
    units_sold, units_returned, units_net, revenue_wb, cost_sold_total,
    commission_rub, commission_pct, logistics_rub, storage_rub, net_profit, created_at
  )
  SELECT
    s.id, s.wb_article, s.barcode, p_year,
    EXTRACT(week FROM r.rr_dt)::int,
    COALESCE(s.cost_price_rub, 0),
    SUM(CASE WHEN r.doc_type_name = 'Продажа' THEN COALESCE(r.quantity,0) ELSE 0 END)::numeric,
    SUM(CASE WHEN r.doc_type_name = 'Возврат' THEN COALESCE(r.quantity,0) ELSE 0 END)::numeric,
    SUM(CASE WHEN r.doc_type_name = 'Продажа' THEN COALESCE(r.quantity,0)
             WHEN r.doc_type_name = 'Возврат' THEN -COALESCE(r.quantity,0) ELSE 0 END)::numeric,
    SUM(CASE WHEN r.doc_type_name = 'Продажа' THEN COALESCE(r.retail_price,0)*COALESCE(r.quantity,0)
             WHEN r.doc_type_name = 'Возврат' THEN -COALESCE(r.retail_price,0)*COALESCE(r.quantity,0) ELSE 0 END)::numeric,
    SUM(public.cost_at(s.id, r.rr_dt::date) *
      CASE WHEN r.doc_type_name = 'Продажа' THEN COALESCE(r.quantity,0)
           WHEN r.doc_type_name = 'Возврат' THEN -COALESCE(r.quantity,0) ELSE 0 END)::numeric,
    SUM(CASE WHEN r.doc_type_name = 'Продажа' THEN COALESCE(r.retail_price,0)*COALESCE(r.quantity,0) - COALESCE(r.ppvz_for_pay,0)
             WHEN r.doc_type_name = 'Возврат' THEN -(COALESCE(r.retail_price,0)*COALESCE(r.quantity,0) - COALESCE(r.ppvz_for_pay,0)) ELSE 0 END)::numeric,
    CASE WHEN SUM(CASE WHEN r.doc_type_name = 'Продажа' THEN COALESCE(r.retail_price,0)*COALESCE(r.quantity,0) ELSE 0 END) > 0
      THEN SUM(CASE WHEN r.doc_type_name = 'Продажа' THEN COALESCE(r.retail_price,0)*COALESCE(r.quantity,0) - COALESCE(r.ppvz_for_pay,0) ELSE 0 END)
           / SUM(CASE WHEN r.doc_type_name = 'Продажа' THEN COALESCE(r.retail_price,0)*COALESCE(r.quantity,0) ELSE 0 END)
      ELSE 0 END,
    SUM(COALESCE(r.delivery_rub,0))::numeric,
    SUM(COALESCE(r.storage_fee,0))::numeric,
    (
      SUM(CASE WHEN r.doc_type_name = 'Продажа' THEN COALESCE(r.ppvz_for_pay,0)
               WHEN r.doc_type_name = 'Возврат' THEN -COALESCE(r.ppvz_for_pay,0) ELSE 0 END)
      - SUM(COALESCE(r.delivery_rub,0))
      - SUM(COALESCE(r.storage_fee,0))
      - SUM(COALESCE(r.deduction,0))
      - SUM(COALESCE(r.penalty,0))
      - SUM(public.cost_at(s.id, r.rr_dt::date) *
          CASE WHEN r.doc_type_name = 'Продажа' THEN COALESCE(r.quantity,0)
               WHEN r.doc_type_name = 'Возврат' THEN -COALESCE(r.quantity,0) ELSE 0 END)
      - SUM(CASE WHEN r.doc_type_name = 'Продажа' THEN COALESCE(r.retail_amount,0)*0.06
                 WHEN r.doc_type_name = 'Возврат' THEN -COALESCE(r.retail_amount,0)*0.06 ELSE 0 END)
    )::numeric,
    now()
  FROM public.wb_reports_fact r
  JOIN public.sku_catalog s ON s.wb_article = r.nm_id
  WHERE EXTRACT(isoyear FROM r.rr_dt)::int = p_year
  GROUP BY s.id, s.wb_article, s.barcode, s.cost_price_rub, EXTRACT(week FROM r.rr_dt);

  INSERT INTO public.sku_weekly_metrics (
    sku_id, wb_article, barcode, year, week_num, cost_per_unit,
    units_sold, units_returned, units_net, revenue_wb, cost_sold_total,
    commission_rub, commission_pct, logistics_rub, storage_rub, net_profit, created_at
  )
  SELECT NULL, NULL, NULL, p_year,
    EXTRACT(week FROM r.rr_dt)::int, 0, 0, 0, 0, 0, 0, 0, 0,
    SUM(COALESCE(r.delivery_rub,0))::numeric,
    SUM(COALESCE(r.storage_fee,0))::numeric,
    -(SUM(COALESCE(r.delivery_rub,0)) + SUM(COALESCE(r.storage_fee,0))
      + SUM(COALESCE(r.deduction,0)) + SUM(COALESCE(r.penalty,0)))::numeric,
    now()
  FROM public.wb_reports_fact r
  LEFT JOIN public.sku_catalog s ON s.wb_article = r.nm_id
  WHERE EXTRACT(isoyear FROM r.rr_dt)::int = p_year AND s.id IS NULL
  GROUP BY EXTRACT(week FROM r.rr_dt);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$function$;
