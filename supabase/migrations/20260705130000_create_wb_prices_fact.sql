-- 14a-1: снапшот цен WB по SKU.
-- Каждый заход fetch-wb-prices пишет snapshot на сегодняшнюю дату (UPSERT).
-- price_rub — базовая цена без скидки (WB "price")
-- discount_pct — процент скидки продавца
-- club_discount_pct — доп. скидка WB Club
-- final_price_rub — итоговая цена для покупателя (после обеих скидок)

CREATE TABLE IF NOT EXISTS public.wb_prices_fact (
  nm_id            bigint  NOT NULL,
  date             date    NOT NULL,
  price_rub        numeric(12,2) NOT NULL,
  discount_pct     numeric(5,2)  NOT NULL DEFAULT 0,
  club_discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  final_price_rub  numeric(12,2) NOT NULL,
  editable_size_price boolean NOT NULL DEFAULT false,
  fetched_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nm_id, date)
);

CREATE INDEX IF NOT EXISTS wb_prices_fact_date_idx ON public.wb_prices_fact (date);
CREATE INDEX IF NOT EXISTS wb_prices_fact_nm_id_idx ON public.wb_prices_fact (nm_id);

COMMENT ON TABLE public.wb_prices_fact IS 'Ежедневный снапшот цен WB по nm_id. Источник: discounts-prices-api /api/v2/list/goods/filter.';

-- Текущие цены (последний снапшот на каждый nm_id) — вьюха для UI.
CREATE OR REPLACE VIEW public.v_wb_prices_current AS
SELECT DISTINCT ON (nm_id)
  nm_id, date, price_rub, discount_pct, club_discount_pct, final_price_rub, editable_size_price, fetched_at
FROM public.wb_prices_fact
ORDER BY nm_id, date DESC;

-- История цен за N дней (для sparkline).
CREATE OR REPLACE FUNCTION public.get_wb_prices_history(p_nm_ids bigint[], p_days int DEFAULT 30)
 RETURNS TABLE(nm_id bigint, date date, final_price_rub numeric)
 LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  SELECT nm_id, date, final_price_rub
  FROM public.wb_prices_fact
  WHERE nm_id = ANY(p_nm_ids)
    AND date >= (CURRENT_DATE - (p_days || ' days')::interval)::date
  ORDER BY nm_id, date;
$function$;
