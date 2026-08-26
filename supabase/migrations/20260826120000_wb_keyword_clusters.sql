-- Частотность кластеров ключевых слов из выгрузки кабинета WB
-- («Кластеры: сравнение позиций», xlsx) + view покрытия кластеров текстом карточки.
--
-- Зачем: до сих пор мы не знали, по каким запросам карточка вообще должна находиться
-- и какие из них покрыты текстом. SEO-проверки (v_sku_seo_issues) смотрели на форму
-- описания, но не на спрос. Эта таблица — сторона спроса.
--
-- Данные грузит scripts/import_keyword_clusters.py из xlsx-выгрузки кабинета.
-- Срез иммутабельный: каждая выгрузка кладётся своим snapshot_date, старые не трогаем —
-- по ним видно движение частотности и позиций между выгрузками.

CREATE TABLE IF NOT EXISTS public.wb_keyword_clusters (
  id               BIGSERIAL PRIMARY KEY,
  snapshot_date    DATE    NOT NULL,
  nm_id            BIGINT  NOT NULL,
  cluster          TEXT    NOT NULL,
  frequency        INTEGER NOT NULL CHECK (frequency >= 0),
  -- Позиция карточки по кластеру. В выгрузке 23.08.2026 пуста у всех:
  -- ни один товар не попал даже в ТОП-100, показывать нечего.
  position_current INTEGER,
  -- Доля кластеров товара, где карточка в ТОП-100, как её посчитал сам кабинет.
  top100_share_pct NUMERIC,
  source           TEXT    NOT NULL DEFAULT 'wb_cabinet_xlsx',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, nm_id, cluster)
);

COMMENT ON TABLE public.wb_keyword_clusters IS
  'Частотность кластеров ключевых слов по SKU из выгрузки кабинета WB. Срез на snapshot_date, append-only.';
COMMENT ON COLUMN public.wb_keyword_clusters.position_current IS
  'Позиция карточки по кластеру на snapshot_date. NULL = карточки нет в выдаче (вне ТОП-100).';

CREATE INDEX IF NOT EXISTS wb_keyword_clusters_nm_date_idx
  ON public.wb_keyword_clusters (nm_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS wb_keyword_clusters_cluster_idx
  ON public.wb_keyword_clusters (cluster);

-- Чтение идёт server-side под service_role, анониму таблица не нужна.
-- «RLS включён, политик нет» = закрыто снаружи (см. 20260822140000).
ALTER TABLE public.wb_keyword_clusters ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Покрытие: каждый кластер против текста карточки, на последнем срезе.
-- Кластер считается покрытым, если КАЖДОЕ его слово встречается в тексте
-- (title + description + characteristics). Нормализация — как в v_sku_seo_issues:
-- lower + ё→е, иначе «мешочки» и «Мешочки» разойдутся.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_sku_keyword_coverage
WITH (security_invoker = on) AS
WITH latest AS (
  SELECT max(snapshot_date) AS snapshot_date FROM public.wb_keyword_clusters
),
sku_text AS (
  SELECT
    c.wb_article,
    c.my_article,
    c.subject_name,
    lower(replace(
      coalesce(c.title,'') || ' ' ||
      coalesce(c.description,'') || ' ' ||
      coalesce(c.characteristics::text,''),
      'ё','е')) AS blob
  FROM public.sku_catalog c
)
SELECT
  k.snapshot_date,
  k.nm_id,
  s.my_article,
  s.subject_name,
  k.cluster,
  k.frequency,
  k.position_current,
  -- bool_and по пустому множеству слов даёт NULL, поэтому coalesce в false.
  coalesce((
    SELECT bool_and(s.blob LIKE '%' || w || '%')
    FROM regexp_split_to_table(lower(replace(k.cluster,'ё','е')), '\s+') AS w
    WHERE w <> ''
  ), false) AS is_covered
FROM public.wb_keyword_clusters k
JOIN latest l ON l.snapshot_date = k.snapshot_date
LEFT JOIN sku_text s ON s.wb_article = k.nm_id;

COMMENT ON VIEW public.v_sku_keyword_coverage IS
  'Кластер × SKU на последнем срезе: покрыт ли кластер текстом карточки.';

-- ---------------------------------------------------------------------------
-- Свёртка по SKU: сколько спроса покрыто текстом. Считаем не по числу кластеров,
-- а по частотности — десять мусорных кластеров не должны перевешивать один жирный.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_sku_keyword_coverage_summary
WITH (security_invoker = on) AS
SELECT
  c.wb_article                        AS nm_id,
  c.my_article,
  c.subject_name,
  c.is_active,
  count(v.cluster)                    AS clusters_total,
  count(v.cluster) FILTER (WHERE v.is_covered) AS clusters_covered,
  coalesce(sum(v.frequency), 0)       AS freq_total,
  coalesce(sum(v.frequency) FILTER (WHERE v.is_covered), 0) AS freq_covered,
  CASE WHEN coalesce(sum(v.frequency), 0) > 0
       THEN round(100.0 * coalesce(sum(v.frequency) FILTER (WHERE v.is_covered), 0)
                        / sum(v.frequency), 1)
  END                                 AS freq_covered_pct,
  count(v.cluster) FILTER (WHERE v.position_current IS NOT NULL) AS clusters_in_top100
FROM public.sku_catalog c
LEFT JOIN public.v_sku_keyword_coverage v ON v.nm_id = c.wb_article
GROUP BY c.wb_article, c.my_article, c.subject_name, c.is_active;

COMMENT ON VIEW public.v_sku_keyword_coverage_summary IS
  'По SKU: доля частотности, покрытая текстом карточки. clusters_total = 0 — частотности нет, SKU не выгружали.';
