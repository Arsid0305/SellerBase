-- Проверка карточек: вспомогательная функция + view находок.
-- Расчёт — только view (принцип №4). Ничего не пишет и в WB не ходит.

-- Вырезает известные ложные срабатывания из текста до поиска стоп-слова.
-- Пример: слово «посуд» ищется, но «посудомоечная машина» — способ ухода, не назначение;
-- «для детей» ищется, но «в недоступном для детей месте» — предупреждение по безопасности.
CREATE OR REPLACE FUNCTION public.seo_strip(p_text TEXT, p_patterns TEXT[])
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_out TEXT := coalesce(p_text, '');
  v_pat TEXT;
BEGIN
  IF p_patterns IS NULL OR cardinality(p_patterns) = 0 THEN
    RETURN v_out;
  END IF;
  FOREACH v_pat IN ARRAY p_patterns LOOP
    v_out := replace(v_out, lower(replace(v_pat, 'ё', 'е')), ' ');
  END LOOP;
  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.seo_strip(TEXT, TEXT[]) IS
  'Гасит документированные ложные срабатывания словаря seo_stop_words до поиска.';

CREATE OR REPLACE VIEW public.v_sku_seo_issues
WITH (security_invoker = on) AS
WITH cfg AS (
  SELECT
    max(value) FILTER (WHERE key='seo_desc_len_min')::int      AS len_min,
    max(value) FILTER (WHERE key='seo_desc_len_target')::int   AS len_target,
    max(value) FILTER (WHERE key='seo_desc_len_max')::int      AS len_max,
    max(value) FILTER (WHERE key='seo_lead_chars')::int        AS lead_chars,
    max(value) FILTER (WHERE key='seo_chars_min_filled')::int  AS chars_min
  FROM public.app_settings
),
sku AS (
  SELECT
    c.my_article,
    c.wb_article,
    c.subject_name,
    coalesce(c.title,'')       AS title,
    coalesce(c.description,'') AS descr,
    c.characteristics,
    lower(replace(
      coalesce(c.title,'') || ' ' || coalesce(c.description,'') || ' ' ||
      coalesce(c.characteristics::text,''), 'ё','е'))          AS haystack,
    coalesce(jsonb_array_length(c.characteristics),0)          AS ch_count
  FROM public.sku_catalog c
),
stop_hits AS (
  SELECT
    s.my_article, s.wb_article, s.subject_name,
    CASE w.risk WHEN 'R' THEN 'stop_word_r' ELSE 'stop_word_a' END AS check_name,
    w.risk,
    w.kw                       AS finding,
    coalesce(w.note,'')        AS detail,
    coalesce(w.replacement,'') AS suggestion
  FROM sku s
  JOIN public.seo_stop_words w
    ON w.active
   AND w.risk IN ('R','A')
   AND NOT (s.subject_name = ANY (w.except_subjects))
   AND position(w.kw IN public.seo_strip(s.haystack, w.strip_patterns)) > 0
),
missing_g AS (
  SELECT
    s.my_article, s.wb_article, s.subject_name,
    'missing_key'::text AS check_name,
    'G'::text           AS risk,
    w.kw                AS finding,
    coalesce(w.note,'') AS detail,
    'добавить ключ в наименование, характеристики или описание'::text AS suggestion
  FROM sku s
  JOIN public.seo_stop_words w
    ON w.active AND w.risk = 'G'
   AND s.subject_name = ANY (w.only_subjects)
  WHERE position(w.kw IN s.haystack) = 0
),
len_issues AS (
  SELECT
    s.my_article, s.wb_article, s.subject_name,
    'desc_length'::text AS check_name,
    CASE WHEN length(s.descr) < c.len_min THEN 'A' ELSE 'G' END AS risk,
    length(s.descr)::text AS finding,
    CASE
      WHEN length(s.descr) < c.len_min
        THEN 'Короче ' || c.len_min || ' знаков — недогруз по SEO'
      WHEN length(s.descr) < c.len_target
        THEN 'Ниже ориентира ' || c.len_target || '–' || c.len_max
      ELSE 'Выше ориентира ' || c.len_target || '–' || c.len_max
    END AS detail,
    ('ориентир ' || c.len_target || '–' || c.len_max || ' знаков')::text AS suggestion
  FROM sku s CROSS JOIN cfg c
  WHERE length(s.descr) < c.len_target OR length(s.descr) > c.len_max
),
lead_issues AS (
  SELECT
    s.my_article, s.wb_article, s.subject_name,
    'lead_no_key'::text AS check_name,
    'A'::text           AS risk,
    left(s.descr, c.lead_chars) AS finding,
    ('В первых ' || c.lead_chars || ' знаках нет первого слова наименования')::text AS detail,
    'вынести суть и главный ключ в начало, без вступления'::text AS suggestion
  FROM sku s CROSS JOIN cfg c
  WHERE s.title <> '' AND s.descr <> ''
    AND position(
          lower(replace(split_part(s.title,' ',1),'ё','е'))
          IN lower(replace(left(s.descr, c.lead_chars),'ё','е'))
        ) = 0
),
chars_issues AS (
  SELECT
    s.my_article, s.wb_article, s.subject_name,
    'characteristics_thin'::text AS check_name,
    'A'::text AS risk,
    s.ch_count::text AS finding,
    ('Заполнено ' || s.ch_count || ' полей, минимум ' || c.chars_min)::text AS detail,
    'основная масса ядра идёт в характеристики; пустые поля режут ранжирование'::text AS suggestion
  FROM sku s CROSS JOIN cfg c
  WHERE s.ch_count < c.chars_min
),
glue_issues AS (
  SELECT DISTINCT
    s.my_article, s.wb_article, s.subject_name,
    'characteristic_glued'::text AS check_name,
    'A'::text AS risk,
    (ch.value ->> 'name') AS finding,
    'Значения склеены через запятую в одном поле — товар не попадёт в фильтры'::text AS detail,
    'каждое значение отдельной строкой (правило WB)'::text AS suggestion
  FROM sku s
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(s.characteristics,'[]'::jsonb)) AS ch(value)
  WHERE jsonb_typeof(ch.value -> 'value') = 'array'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(ch.value -> 'value') AS v(txt)
      WHERE v.txt LIKE '%, %'
    )
)
SELECT * FROM stop_hits
UNION ALL SELECT * FROM missing_g
UNION ALL SELECT * FROM len_issues
UNION ALL SELECT * FROM lead_issues
UNION ALL SELECT * FROM chars_issues
UNION ALL SELECT * FROM glue_issues;

COMMENT ON VIEW public.v_sku_seo_issues IS
  'Находки проверки карточек по каждому SKU. Правила — seo_stop_words, пороги — app_settings.';
