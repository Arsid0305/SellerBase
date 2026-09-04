-- Метрики участия в акциях из GET /api/v1/calendar/promotions/details.
--
-- Зачем: метод /nomenclatures, которым функция тянула состав акции, для авто-акций
-- закрыт — WB отдаёт 422 «Unprocessable entity» (проверено 04.09.2026 на четырёх
-- живых акциях; то же подтверждает форум разработчиков WB). А сейчас все акции WB
-- имеют тип 'auto', поэтому состав участников через API недоступен в принципе.
--
-- Что вместо: /details отдаёт по каждой акции агрегаты и — главное — пороги
-- бустинга. Для «Бархатных скидок» на 04.09: участвуют 2 товара из 57 (4%),
-- бустинг 25%; при 50% участия он растёт до 30%, при 80% — до 35%. Это и есть
-- то, ради чего матрица /promo нужна: видно, сколько бустинга мы недобираем.

ALTER TABLE public.wb_promotions
  ADD COLUMN IF NOT EXISTS description          text,
  ADD COLUMN IF NOT EXISTS advantages           jsonb,
  ADD COLUMN IF NOT EXISTS in_promo_total       integer,
  ADD COLUMN IF NOT EXISTS not_in_promo_total   integer,
  ADD COLUMN IF NOT EXISTS participation_pct    integer,
  ADD COLUMN IF NOT EXISTS exception_count      integer,
  ADD COLUMN IF NOT EXISTS ranging              jsonb,
  ADD COLUMN IF NOT EXISTS details_fetched_at   timestamptz;

COMMENT ON COLUMN public.wb_promotions.in_promo_total     IS 'Сколько наших товаров участвует в акции (inPromoActionTotal)';
COMMENT ON COLUMN public.wb_promotions.not_in_promo_total IS 'Сколько наших товаров доступно, но не участвует (notInPromoActionTotal)';
COMMENT ON COLUMN public.wb_promotions.participation_pct  IS 'Процент участия, по нему WB считает бустинг (participationPercentage)';
COMMENT ON COLUMN public.wb_promotions.exception_count    IS 'Товаров в исключениях (exceptionProductsCount)';
COMMENT ON COLUMN public.wb_promotions.ranging            IS 'Пороги бустинга: [{condition, participationRate, boost}] — при каком проценте участия какой буст';

-- Ближайший порог бустинга и сколько до него не хватает.
CREATE OR REPLACE VIEW public.v_wb_promotions_boost
WITH (security_invoker = true) AS
SELECT
  p.promotion_id,
  p.name,
  p.type,
  p.start_at,
  p.end_at,
  p.in_promo_total,
  p.not_in_promo_total,
  p.participation_pct,
  p.exception_count,
  cur.boost                                        AS current_boost,
  nxt.participation_rate                           AS next_rate,
  nxt.boost                                        AS next_boost,
  GREATEST(nxt.participation_rate - p.participation_pct, 0) AS pct_to_next,
  CEIL((nxt.participation_rate - p.participation_pct)::numeric
       * (coalesce(p.in_promo_total,0) + coalesce(p.not_in_promo_total,0)) / 100.0) AS skus_to_next
FROM public.wb_promotions p
LEFT JOIN LATERAL (
  SELECT (r->>'boost')::int AS boost
  FROM jsonb_array_elements(coalesce(p.ranging, '[]'::jsonb)) r
  WHERE (r->>'participationRate')::int <= coalesce(p.participation_pct, 0)
  ORDER BY (r->>'participationRate')::int DESC LIMIT 1
) cur ON true
LEFT JOIN LATERAL (
  SELECT (r->>'participationRate')::int AS participation_rate, (r->>'boost')::int AS boost
  FROM jsonb_array_elements(coalesce(p.ranging, '[]'::jsonb)) r
  WHERE (r->>'participationRate')::int > coalesce(p.participation_pct, 0)
  ORDER BY (r->>'participationRate')::int ASC LIMIT 1
) nxt ON true;

COMMENT ON VIEW public.v_wb_promotions_boost IS
  'Акции с текущим бустингом и ближайшим порогом: сколько процентов и сколько SKU не хватает до следующего уровня';
