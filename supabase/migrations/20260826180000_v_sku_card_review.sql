-- Ревизия карточек: заполненность характеристик + сводная строка по SKU.
--
-- Опирается на wb_subject_charcs (что WB ждёт) и sku_catalog.characteristics
-- (что заполнено). До появления справочника вторая половина этого сравнения
-- отсутствовала, поэтому «заполнено 10 полей» ни о чём не говорило.
--
-- Ничего не пишет и в WB не ходит: расчёт — только view (принцип №4).
-- Карточки правятся руками в кабинете, задача ревизии — открыть карточку,
-- уже зная, что в ней чинить.

-- ---------------------------------------------------------------------------
-- 1. SKU × характеристика предмета. Строка на каждое поле, которое WB ждёт.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_sku_charc_audit
WITH (security_invoker = on) AS
SELECT
  c.wb_article                          AS nm_id,
  c.my_article,
  c.subject_id,
  c.subject_name,
  sc.charc_id,
  sc.name                               AS charc_name,
  sc.required,
  sc.popular,
  sc.unit_name,
  sc.max_count,
  filled.value                          AS filled_value,
  (filled.value IS NOT NULL)            AS is_filled
FROM public.sku_catalog c
JOIN public.wb_subject_charcs sc
  ON sc.subject_id = c.subject_id
 AND NOT sc.is_foreign          -- поля для продавцов других стран пропуском не считаем
LEFT JOIN LATERAL (
  SELECT ch->>'value' AS value
  FROM jsonb_array_elements(coalesce(c.characteristics, '[]'::jsonb)) AS ch
  WHERE (ch->>'id')::bigint = sc.charc_id
    -- WB отдаёт пустое значение и как '', и как пустой массив — оба не заполнены
    AND ch->>'value' IS NOT NULL
    AND ch->>'value' <> ''
    AND ch->>'value' <> '[]'
  LIMIT 1
) filled ON true
WHERE c.is_active;

COMMENT ON VIEW public.v_sku_charc_audit IS
  'SKU × характеристика предмета: ждёт ли WB это поле, обязательно ли, заполнено ли. Страновые поля исключены.';

-- ---------------------------------------------------------------------------
-- 2. Сводная строка по SKU — всё, что нужно знать перед правкой карточки.
--    Одна строка = одна карточка, чтобы можно было отфильтровать по группе
--    и выгрузить в файл.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_sku_card_review
WITH (security_invoker = on) AS
WITH charc AS (
  SELECT
    nm_id,
    count(*)                                              AS charcs_total,
    count(*) FILTER (WHERE is_filled)                     AS charcs_filled,
    count(*) FILTER (WHERE required)                      AS charcs_required,
    count(*) FILTER (WHERE required AND NOT is_filled)    AS required_missing,
    count(*) FILTER (WHERE popular AND NOT is_filled)     AS popular_missing,
    string_agg(charc_name, '; ' ORDER BY required DESC, popular DESC NULLS LAST, charc_name)
      FILTER (WHERE NOT is_filled)                        AS missing_fields
  FROM public.v_sku_charc_audit
  GROUP BY nm_id
),
seo AS (
  SELECT
    wb_article                                            AS nm_id,
    count(*)                                              AS seo_issues,
    count(*) FILTER (WHERE risk = 'R')                    AS seo_risk_r,
    count(*) FILTER (WHERE risk = 'A')                    AS seo_risk_a,
    string_agg(DISTINCT finding, '; ')                    AS seo_findings
  FROM public.v_sku_seo_issues
  GROUP BY wb_article
),
stock AS (
  SELECT nm_id, sum(quantity) AS qty
  FROM public.wb_stocks
  WHERE nm_id IS NOT NULL
  GROUP BY nm_id
)
SELECT
  c.wb_article                                            AS nm_id,
  c.my_article,
  c.subject_id,
  c.subject_name,
  c.title,
  length(coalesce(c.title, ''))                           AS title_len,
  length(coalesce(c.description, ''))                     AS description_len,
  (c.description IS NULL OR c.description = '')           AS description_empty,

  coalesce(ch.charcs_total, 0)                            AS charcs_total,
  coalesce(ch.charcs_filled, 0)                           AS charcs_filled,
  coalesce(ch.charcs_required, 0)                         AS charcs_required,
  coalesce(ch.required_missing, 0)                        AS required_missing,
  coalesce(ch.popular_missing, 0)                         AS popular_missing,
  CASE WHEN coalesce(ch.charcs_total, 0) > 0
       THEN round(100.0 * ch.charcs_filled / ch.charcs_total, 0)
  END                                                     AS charcs_filled_pct,
  ch.missing_fields,

  c.length_cm, c.width_cm, c.height_cm, c.volume_l,
  c.unit_weight_kg,
  (c.dimensions->>'weightBrutto')::numeric                AS wb_weight_brutto,
  (c.length_cm IS NULL OR c.width_cm IS NULL OR c.height_cm IS NULL) AS dims_missing,

  kw.clusters_total,
  kw.freq_total,
  kw.freq_covered_pct,

  coalesce(seo.seo_issues, 0)                             AS seo_issues,
  coalesce(seo.seo_risk_r, 0)                             AS seo_risk_r,
  coalesce(seo.seo_risk_a, 0)                             AS seo_risk_a,
  seo.seo_findings,

  coalesce(st.qty, 0)                                     AS stock_qty,
  c.cost_price_rub,
  c.last_content_sync_at
FROM public.sku_catalog c
LEFT JOIN charc ch  ON ch.nm_id  = c.wb_article
LEFT JOIN seo       ON seo.nm_id = c.wb_article
LEFT JOIN stock st  ON st.nm_id  = c.wb_article
LEFT JOIN public.v_sku_keyword_coverage_summary kw ON kw.nm_id = c.wb_article
WHERE c.is_active;

COMMENT ON VIEW public.v_sku_card_review IS
  'Сводная ревизия карточки: заполненность полей WB, габариты, вес, покрытие ключами, находки SEO, остаток. Одна строка на SKU.';
