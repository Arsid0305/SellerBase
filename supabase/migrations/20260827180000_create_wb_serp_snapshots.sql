-- Срезы поисковой выдачи WB для сверки и мониторинга конкурентов.
-- Источник: выгрузка выдачи по запросу (xlsx), одна строка = одна позиция.
-- Правило ведения — docs/seo/card-assembly.md, источник 3 свода фактов.
-- Применена через MCP apply_migration 2026-08-27.

create table if not exists public.wb_serp_snapshots (
  id                bigserial primary key,
  snapshot_date     date        not null,
  query             text        not null,
  position          integer     not null,
  position_organic  integer,
  is_ad             boolean     not null default false,
  nm_id             bigint      not null,
  brand             text,
  title             text,
  price_rub         numeric,
  promo             text,
  warehouse         text,
  delivery_hours    integer,
  rating            numeric,
  reviews_count     integer,
  slides_count      integer,
  source            text        not null default 'xlsx_export',
  created_at        timestamptz not null default now(),
  constraint wb_serp_snapshots_pos_uniq unique (snapshot_date, query, position)
);

comment on table  public.wb_serp_snapshots is
  'Срезы поисковой выдачи WB по запросу. Одна строка — одна позиция. Заполняется из выгрузки выдачи.';
comment on column public.wb_serp_snapshots.query is
  'Поисковый запрос, по которому снята выдача. Ключ наблюдения — без него строка бессмысленна.';
comment on column public.wb_serp_snapshots.position is
  'Место в выдаче как показано покупателю: реклама и органика вперемешку.';
comment on column public.wb_serp_snapshots.position_organic is
  'Органическое место, если выгрузка его отдаёт. У рекламных строк пусто.';
comment on column public.wb_serp_snapshots.is_ad is
  'Позиция куплена рекламой. Схему наименований по таким строкам не считают.';
comment on column public.wb_serp_snapshots.slides_count is
  'Сколько изображений в карточке конкурента — планка по медиане топа.';

create index if not exists wb_serp_snapshots_query_date_idx
  on public.wb_serp_snapshots (query, snapshot_date desc, position);
create index if not exists wb_serp_snapshots_nm_idx
  on public.wb_serp_snapshots (nm_id, snapshot_date desc);
create index if not exists wb_serp_snapshots_date_idx
  on public.wb_serp_snapshots (snapshot_date desc);

alter table public.wb_serp_snapshots enable row level security;

-- Наши карточки помечаются соединением с каталогом, а не хранимым флагом:
-- ассортимент меняется, а срез выдачи — исторический факт и переписываться не должен.
create or replace view public.v_serp_snapshots as
select
  s.*,
  c.my_article,
  (c.my_article is not null) as is_ours
from public.wb_serp_snapshots s
left join public.sku_catalog c on c.wb_article = s.nm_id;

comment on view public.v_serp_snapshots is
  'Срезы выдачи с пометкой наших карточек: is_ours и my_article подтягиваются из sku_catalog.';
