-- Поисковые запросы из кабинета WB (Аналитика → Поисковые запросы, подписка «Джем»).
--
-- Зачем отдельно от wb_keyword_clusters: та таблица содержит только частотность
-- и замкнута на кластеры, которые WB уже привязал к карточке. Здесь по каждому
-- запросу есть позиция, видимость, переходы, корзина и заказы — то есть видно
-- не только «сколько ищут», но и «берём ли мы это».
--
-- Ограничение выгрузки: фильтр «Заказывали». Запросы без единого заказа
-- в файл не попадают, поэтому отсутствие запроса здесь по-прежнему
-- не доказывает отсутствия спроса.

create table if not exists public.wb_search_queries (
  id bigserial primary key,
  period_from date not null,
  period_to date not null,
  my_article text,
  nm_id bigint,
  subject_name text,
  query text not null,
  query_count integer,
  visibility_pct numeric,
  position_avg numeric,
  position_median numeric,
  clicks integer,
  cart_adds integer,
  cart_conv_pct numeric,
  orders integer,
  order_conv_pct numeric,
  price_min_rub numeric,
  price_max_rub numeric,
  source text not null default 'wb_cabinet_xlsx',
  created_at timestamptz not null default now(),
  constraint wb_search_queries_uniq unique (period_from, period_to, nm_id, query)
);

create index if not exists wb_search_queries_query_idx
  on public.wb_search_queries using gin (to_tsvector('russian', query));
create index if not exists wb_search_queries_article_idx
  on public.wb_search_queries (my_article);

alter table public.wb_search_queries enable row level security;

comment on table public.wb_search_queries is
  'Поисковые запросы из кабинета WB (Аналитика → Поисковые запросы, подписка Джем). '
  'В отличие от wb_keyword_clusters содержит позиции, переходы, конверсии и заказы '
  'по каждому запросу. Фильтр выгрузки «Заказывали» — запросы без заказов сюда не попадают.';
