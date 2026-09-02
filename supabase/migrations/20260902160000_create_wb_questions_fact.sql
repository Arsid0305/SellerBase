-- Вопросы покупателей WB (Feedbacks API, метод /api/v1/questions).
--
-- Зачем отдельно от wb_reviews_fact: отзыв пишут ПОСЛЕ покупки — это оценка;
-- вопрос задают ДО неё — это сомнение, которое мешает купить. Именно оно должно
-- сниматься в первых 150 знаках описания. Прецедент: разделение мелкой и крупной
-- сетки у мешков пришло из вопросов, а не из отзывов.
--
-- Контракт разведан probe-wb-api 02.09.2026:
--   GET /api/v1/questions?take=&skip=&isAnswered=
--   → data.questions[]: { id, text, createdDate, state,
--                         answer: { text, editable, createDate },
--                         productDetails: { imtId, nmId, productName, supplierArticle, brandName } }
--   Плюс data.countUnanswered и data.countArchive.

create table if not exists public.wb_questions_fact (
  id text primary key,
  nm_id bigint,
  imt_id bigint,
  product_name text,
  supplier_article text,
  brand_name text,
  text text,
  state text,
  answered boolean not null default false,
  answer_text text,
  answer_created_at timestamptz,
  answer_editable boolean,
  was_viewed boolean not null default false,
  created_at timestamptz not null,
  fetched_at timestamptz not null default now()
);

create index if not exists wb_questions_fact_nm_idx
  on public.wb_questions_fact (nm_id);
create index if not exists wb_questions_fact_created_idx
  on public.wb_questions_fact (created_at desc);
-- Полнотекстовый поиск по тексту вопроса — так же, как сейчас ищем по отзывам.
create index if not exists wb_questions_fact_text_idx
  on public.wb_questions_fact using gin (to_tsvector('russian', coalesce(text, '')));

alter table public.wb_questions_fact enable row level security;

comment on table public.wb_questions_fact is
  'Вопросы покупателей WB (Feedbacks API /api/v1/questions). В отличие от отзывов '
  'задаются ДО покупки — это возражения, которые мешают купить. Источник для первых '
  '150 знаков описания. Собирается функцией fetch-wb-questions.';
