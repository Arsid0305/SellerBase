-- Факты о товарах, снятые с фотографий/закупки, и содержимое слайдов карточек.
--
-- Зачем: по канону docs/seo/card-assembly.md §1.1 разбор группы начинается с фотографий,
-- а §1.4 требует, чтобы заполненное поле считалось верным только после проверки.
-- Фотографии приходят в чат и нигде не оседают — без этих таблиц каждый разбор
-- начинается с повторной пересылки фото владелицей.

-- 1. Факты о товаре ---------------------------------------------------------
create table if not exists public.wb_product_facts (
  id            bigserial primary key,
  my_article    text        not null,
  nm_id         bigint,
  fact_key      text        not null,   -- 'габариты_кейса', 'диаметр', 'состав_набора', ...
  fact_value    text        not null,
  source        text        not null,   -- photo | xlsx_purchase | reviews | serp | manual
  confidence    text        not null default 'confirmed',  -- confirmed | probable | conflict
  note          text,
  checked_at    date        not null default current_date,
  created_at    timestamptz not null default now(),
  constraint wb_product_facts_source_chk
    check (source in ('photo','xlsx_purchase','reviews','serp','manual')),
  constraint wb_product_facts_confidence_chk
    check (confidence in ('confirmed','probable','conflict')),
  constraint wb_product_facts_uniq unique (my_article, fact_key, source)
);

create index if not exists wb_product_facts_nm_id_idx on public.wb_product_facts (nm_id);
create index if not exists wb_product_facts_key_idx   on public.wb_product_facts (fact_key);

alter table public.wb_product_facts enable row level security;

comment on table  public.wb_product_facts is
  'Проверяемые факты о товаре, снятые с фото карточки, закупочной таблицы или отзывов. Источник обязателен: поле не считается верным, пока не сказано, откуда оно.';
comment on column public.wb_product_facts.confidence is
  'confirmed — подтверждено источником; probable — вывод, не замер; conflict — источники расходятся, см. note.';

-- 2. Слайды карточек --------------------------------------------------------
create table if not exists public.wb_card_slides (
  id            bigserial primary key,
  my_article    text,
  nm_id         bigint,
  slide_no      integer     not null,
  slide_role    text,                    -- титул | зоны | действие | габариты | цвета | подарок | ...
  headline      text,
  body_text     text,
  flags         text[]      not null default '{}',
  note          text,
  checked_at    date        not null default current_date,
  created_at    timestamptz not null default now(),
  constraint wb_card_slides_uniq unique (my_article, slide_no)
);

create index if not exists wb_card_slides_nm_id_idx on public.wb_card_slides (nm_id);
create index if not exists wb_card_slides_flags_idx on public.wb_card_slides using gin (flags);

alter table public.wb_card_slides enable row level security;

comment on table  public.wb_card_slides is
  'Текст и наблюдения по каждому слайду инфографики. Основание для задания на переделку картинок до правки описаний.';
comment on column public.wb_card_slides.flags is
  'Метки проблем: оценочное, медицинское, протухнет, чужой_цвет, общий_слайд, вотермарк, противоречие.';

-- 3. Витрина: что требует переделки -----------------------------------------
create or replace view public.v_card_slide_issues as
select
  s.my_article,
  s.nm_id,
  s.slide_no,
  s.slide_role,
  s.headline,
  s.body_text,
  s.flags,
  s.note,
  c.wb_article is not null as is_ours
from public.wb_card_slides s
left join public.sku_catalog c on c.wb_article = s.nm_id
where cardinality(s.flags) > 0;

alter view public.v_card_slide_issues set (security_invoker = on);

comment on view public.v_card_slide_issues is
  'Слайды с хотя бы одной меткой проблемы — рабочий список на переделку инфографики.';
