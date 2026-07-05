-- 16a: отзывы WB (feedbacks-api).
-- Источник: GET feedbacks-api.wildberries.ru/api/v1/feedbacks?take=5000&skip=0
-- Хранит отвеченные и неотвеченные отзывы. sentiment вычисляется в SQL по рейтингу.

CREATE TABLE IF NOT EXISTS public.wb_reviews_fact (
  id             text PRIMARY KEY,
  nm_id          bigint,
  imt_id         bigint,
  product_name   text,
  supplier_article text,
  brand_name     text,
  rating         smallint NOT NULL,
  text           text,
  pros           text,
  cons           text,
  user_name      text,
  photo_urls     text[],
  video_url      text,
  created_at     timestamptz NOT NULL,
  updated_at     timestamptz,
  answered       boolean NOT NULL DEFAULT false,
  answer_text    text,
  answer_created_at timestamptz,
  was_viewed     boolean NOT NULL DEFAULT false,
  fetched_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wb_reviews_fact_nm_id_idx     ON public.wb_reviews_fact (nm_id);
CREATE INDEX IF NOT EXISTS wb_reviews_fact_created_at_idx ON public.wb_reviews_fact (created_at DESC);
CREATE INDEX IF NOT EXISTS wb_reviews_fact_rating_idx    ON public.wb_reviews_fact (rating);
CREATE INDEX IF NOT EXISTS wb_reviews_fact_answered_idx  ON public.wb_reviews_fact (answered);

COMMENT ON TABLE public.wb_reviews_fact IS 'Отзывы WB. Источник: feedbacks-api /api/v1/feedbacks.';
