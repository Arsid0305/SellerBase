-- Журнал заливок карточек в кабинет.
-- Нужен, чтобы отделить наш эффект от сезонности: карточки, не залитые
-- на момент замера, работают контрольной группой.
create table if not exists public.wb_card_uploads (
  id bigserial primary key,
  my_article text not null,
  nm_id bigint,
  uploaded_on date not null,
  scope text not null,          -- title | fields | description | infographic | video
  note text,
  created_at timestamptz not null default now(),
  constraint wb_card_uploads_scope_chk
    check (scope in ('title','fields','description','infographic','video')),
  constraint wb_card_uploads_uniq unique (my_article, uploaded_on, scope)
);
alter table public.wb_card_uploads enable row level security;

comment on table public.wb_card_uploads is
  'Когда и что залито в кабинет по каждой карточке. Опора для замера эффекта: '
  'сравнивая два среза wb_search_queries, переписанные карточки сопоставляем '
  'с непереписанными за тот же период — разница и есть наш вклад, а не сезон.';

-- Сравнение двух последних срезов поисковых запросов.
create or replace view public.v_search_query_delta as
with periods as (
  select distinct period_to,
         dense_rank() over (order by period_to desc) as rn
  from public.wb_search_queries
),
cur as (
  select q.* from public.wb_search_queries q
  join periods p on p.period_to = q.period_to and p.rn = 1
),
prev as (
  select q.* from public.wb_search_queries q
  join periods p on p.period_to = q.period_to and p.rn = 2
)
select
  coalesce(cur.my_article, prev.my_article)     as my_article,
  coalesce(cur.nm_id, prev.nm_id)               as nm_id,
  coalesce(cur.subject_name, prev.subject_name) as subject_name,
  coalesce(cur.query, prev.query)               as query,
  prev.period_to                                as было_на,
  cur.period_to                                 as стало_на,
  case when prev.nm_id is null then 'новый запрос'
       when cur.nm_id is null then 'выпал'
       else 'есть в обоих' end                  as статус,
  prev.query_count      as частотность_было,
  cur.query_count       as частотность_стало,
  prev.position_median  as позиция_было,
  cur.position_median   as позиция_стало,
  prev.position_median - cur.position_median as позиция_дельта,
  prev.orders           as заказы_было,
  cur.orders            as заказы_стало,
  (select max(uploaded_on) from public.wb_card_uploads u
    where u.my_article = coalesce(cur.my_article, prev.my_article)) as залито
from cur
full join prev on prev.nm_id = cur.nm_id and prev.query = cur.query;

alter view public.v_search_query_delta set (security_invoker = on);

comment on view public.v_search_query_delta is
  'Два последних среза wb_search_queries рядом: новые запросы, выпавшие, '
  'сдвиг позиции и заказов. Колонка «залито» показывает дату правки карточки — '
  'без неё рост нельзя отличить от сезонного.';
