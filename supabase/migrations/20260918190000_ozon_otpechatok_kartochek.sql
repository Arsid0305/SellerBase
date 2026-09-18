-- Содержание карточек Ozon и отпечаток на дату.
--
-- Просьба владелицы 18.09.2026: «ещё бы создать отпечаток карточек с озона
-- как мы с вб сделали, чтоб потом определять показатели сео».
--
-- Смысл тот же, что у sku_content_snapshots по ВБ: текущее состояние
-- перезаписывается при каждой загрузке, а площадка прошлых версий текста не
-- отдаёт. Без точки отсчёта нельзя сказать «до правки было так».
--
-- Важная оговорка, чтобы потом не обмануться. Карточки Ozon владелица
-- переделала до того, как этот отпечаток завели. Значит первый снимок - это
-- состояние ПОСЛЕ правок, а точки «до» по Ozon не существует и уже не будет.
-- Сравнивать можно только вперёд от этой даты.
--
-- Источники, проверены живым запросом 18.09.2026:
--   /v1/product/info/description - название и описание;
--   /v4/product/info/attributes  - характеристики, габариты, фото.

create table if not exists public.ozon_content (
  product_id        bigint primary key,
  offer_id          text,
  name              text,
  description       text,
  barcode           text,
  category_id       bigint,
  type_id           bigint,
  primary_image     text,
  images_count      integer,
  height_mm         integer,
  width_mm          integer,
  depth_mm          integer,
  weight_g          integer,
  attributes        jsonb,
  attributes_count  integer,
  fetched_at        timestamptz not null default now()
);

comment on table public.ozon_content is
  'Содержание карточек Ozon: название, описание, характеристики, фото. Текущий срез, перезаписывается при каждой загрузке.';

create index if not exists ozon_content_offer_idx on public.ozon_content (offer_id);
alter table public.ozon_content enable row level security;

create table if not exists public.ozon_content_snapshots (
  id            bigserial primary key,
  snapshot_date date   not null default current_date,
  product_id    bigint not null,
  offer_id      text,
  name          text,
  description   text,
  attributes    jsonb,
  primary_image text,
  images_count  integer,
  -- Зачем снимали. Первый снимок - 'first_after_owner_edits': карточки уже
  -- переделаны владелицей, состояния «до» по Ozon нет.
  reason        text   not null default 'manual',
  created_at    timestamptz not null default now(),
  constraint ozon_content_snapshots_uniq unique (product_id, snapshot_date)
);

comment on table public.ozon_content_snapshots is
  'Отпечатки карточек Ozon на дату. Точка отсчёта для оценки эффекта правок: площадка прошлых версий текста не отдаёт.';
comment on column public.ozon_content_snapshots.reason is
  'Зачем снимали: first_after_owner_edits - первый снимок, карточки уже переделаны; before_seo_upload - перед заливкой; manual - разовый.';

create index if not exists ozon_content_snapshots_offer_idx
  on public.ozon_content_snapshots (offer_id, snapshot_date desc);
alter table public.ozon_content_snapshots enable row level security;
