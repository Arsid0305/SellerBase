-- Откуда берётся значение характеристики. Без этого ревизия врёт.
--
-- Справочник object/charcs перечисляет ВСЕ поля, которые WB показывает при
-- создании карточки. Но заполненные значения приезжают из cards/list двумя
-- разными путями:
--   * предметные характеристики (Действие, Зона массажа, Материал) — в массиве
--     characteristics;
--   * общие поля карточки (Бренд, Наименование, Описание, Баркод, габариты) —
--     отдельными свойствами, в characteristics их нет.
--
-- Первая версия ревизии искала всё в characteristics и записала «Бренд» в пропуски
-- у всех 71 SKU, хотя бренд АРОЛС заполнен везде. Пятнадцать ложных пропусков
-- на карточку — такой ревизии верить нельзя, поэтому источник фиксируется явно.
--
-- Третий случай: поле есть у предмета, но мы его не тянем с WB вообще
-- (ТН ВЭД, сертификаты, НДС). Про него честный ответ — «не знаем», а не «пусто».
-- Такие поля из процента заполненности исключаются и считаются отдельно.

CREATE TABLE IF NOT EXISTS public.wb_charc_source_map (
  charc_name TEXT PRIMARY KEY,
  source     TEXT NOT NULL CHECK (source IN ('card_field', 'not_fetched')),
  note       TEXT
);

COMMENT ON TABLE public.wb_charc_source_map IS
  'Характеристики, которые не лежат в sku_catalog.characteristics. card_field — берём из колонки карточки; not_fetched — с WB не тянем, состояние неизвестно.';

INSERT INTO public.wb_charc_source_map (charc_name, source, note) VALUES
  -- Есть у нас, но отдельными колонками
  ('Бренд',                      'card_field', 'sku_catalog.brand'),
  ('Наименование',               'card_field', 'sku_catalog.title'),
  ('Описание',                   'card_field', 'sku_catalog.description'),
  ('Баркод',                     'card_field', 'sku_catalog.barcode'),
  ('Артикул OZON',               'card_field', 'sku_catalog.ozon_article'),
  ('Длина упаковки',             'card_field', 'sku_catalog.length_cm'),
  ('Ширина упаковки',            'card_field', 'sku_catalog.width_cm'),
  ('Высота упаковки',            'card_field', 'sku_catalog.height_cm'),
  ('Вес товара с упаковкой (г)', 'card_field', 'dimensions->>weightBrutto'),
  -- Не тянем с WB — доработка фетча, а не работа по карточкам
  ('Код ТН ВЭД',                                     'not_fetched', 'проставлен в кабинете, у нас колонки нет'),
  ('Ставка НДС',                                     'not_fetched', ''),
  ('Код упаковки',                                   'not_fetched', ''),
  ('Страна производства',                            'not_fetched', ''),
  ('Тип доставки',                                   'not_fetched', ''),
  ('Номер декларации соответствия',                  'not_fetched', 'документы карточки'),
  ('Номер сертификата соответствия',                 'not_fetched', 'документы карточки'),
  ('Дата регистрации сертификата/декларации',        'not_fetched', 'документы карточки'),
  ('Дата окончания действия сертификата/декларации', 'not_fetched', 'документы карточки'),
  ('Срок действия регистрационного удостоверения РФ','not_fetched', 'документы карточки'),
  ('Количество штук в товаре по ЭС',                 'not_fetched', '')
ON CONFLICT (charc_name) DO NOTHING;

ALTER TABLE public.wb_charc_source_map ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Ревизия с учётом источника.
-- Пересоздаём, а не заменяем: в v_sku_charc_audit добавилась колонка value_source
-- в середину списка, а CREATE OR REPLACE не умеет менять порядок колонок.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_sku_card_review;
DROP VIEW IF EXISTS public.v_sku_charc_audit;

CREATE VIEW public.v_sku_charc_audit
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
  coalesce(m.source, 'characteristics') AS value_source,
  CASE coalesce(m.source, 'characteristics')
    WHEN 'not_fetched' THEN NULL        -- состояние неизвестно, не пропуск
    WHEN 'card_field'  THEN CASE sc.name
      WHEN 'Бренд'                      THEN nullif(btrim(coalesce(c.brand,'')), '') IS NOT NULL
      WHEN 'Наименование'               THEN nullif(btrim(coalesce(c.title,'')), '') IS NOT NULL
      WHEN 'Описание'                   THEN nullif(btrim(coalesce(c.description,'')), '') IS NOT NULL
      WHEN 'Баркод'                     THEN nullif(btrim(coalesce(c.barcode,'')), '') IS NOT NULL
      WHEN 'Артикул OZON'               THEN c.ozon_article IS NOT NULL
      WHEN 'Длина упаковки'             THEN c.length_cm IS NOT NULL
      WHEN 'Ширина упаковки'            THEN c.width_cm  IS NOT NULL
      WHEN 'Высота упаковки'            THEN c.height_cm IS NOT NULL
      WHEN 'Вес товара с упаковкой (г)' THEN (c.dimensions->>'weightBrutto') IS NOT NULL
    END
    ELSE filled.value IS NOT NULL
  END                                   AS is_filled,
  filled.value                          AS filled_value
FROM public.sku_catalog c
JOIN public.wb_subject_charcs sc
  ON sc.subject_id = c.subject_id
 AND NOT sc.is_foreign          -- поля для продавцов других стран пропуском не считаем
LEFT JOIN public.wb_charc_source_map m ON m.charc_name = sc.name
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
  'SKU × характеристика предмета. is_filled = NULL означает «не тянем с WB», а не «пусто».';

-- Свёртка пересобирается: незаполненным считается только is_filled = false.
CREATE VIEW public.v_sku_card_review
WITH (security_invoker = on) AS
WITH charc AS (
  SELECT
    nm_id,
    count(*) FILTER (WHERE is_filled IS NOT NULL)                  AS charcs_total,
    count(*) FILTER (WHERE is_filled)                              AS charcs_filled,
    count(*) FILTER (WHERE required AND is_filled IS NOT NULL)     AS charcs_required,
    count(*) FILTER (WHERE required AND is_filled IS FALSE)        AS required_missing,
    count(*) FILTER (WHERE popular  AND is_filled IS FALSE)        AS popular_missing,
    count(*) FILTER (WHERE is_filled IS NULL)                      AS charcs_unknown,
    string_agg(charc_name, '; ' ORDER BY required DESC, popular DESC NULLS LAST, charc_name)
      FILTER (WHERE is_filled IS FALSE)                            AS missing_fields
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
  coalesce(ch.charcs_unknown, 0)                          AS charcs_unknown,
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
  'Сводная ревизия карточки. charcs_unknown — поля, которые мы с WB не тянем: не пропуск, а слепая зона.';
