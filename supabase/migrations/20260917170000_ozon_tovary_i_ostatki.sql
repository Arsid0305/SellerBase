-- Ozon, шаг первый: товары и остатки.
-- План контура - docs/integrations/OZON_PODKLYUCHENIE.md.
--
-- Связь с товарами ВБ - по артикулу: у Ozon это offer_id, у нас
-- sku_catalog.my_article. Проверено на живом ответе кабинета 17.09.2026:
-- артикулы совпадают дословно (ACRB1MS106WH и прочие), поэтому руками
-- связывать ничего не нужно.
--
-- Остатки Ozon приходят двумя строками на товар - ФБО и ФБС отдельно.
-- Храним так же: одна строка на товар и тип склада.

create table if not exists public.ozon_products (
  product_id     bigint primary key,
  offer_id       text not null,
  sku            bigint,
  archived       boolean not null default false,
  is_discounted  boolean not null default false,
  has_fbo_stocks boolean not null default false,
  has_fbs_stocks boolean not null default false,
  fetched_at     timestamptz not null default now()
);

create index if not exists ozon_products_offer_id_idx on public.ozon_products (offer_id);

comment on table public.ozon_products is
  'Товары кабинета Ozon. offer_id - тот же артикул, что sku_catalog.my_article.';

-- Текущий остаток: перезаписывается каждым прогоном.
create table if not exists public.ozon_stocks (
  product_id  bigint not null,
  stock_type  text not null check (stock_type in ('fbo', 'fbs')),
  offer_id    text not null,
  sku         bigint,
  present     integer not null default 0,
  reserved    integer not null default 0,
  fetched_at  timestamptz not null default now(),
  primary key (product_id, stock_type)
);

comment on table public.ozon_stocks is
  'Текущие остатки Ozon по типам склада. ФБО и ФБС - отдельные строки, как отдаёт Ozon.';

-- История остатков: по ней потом считается оборачиваемость и «что кончается».
-- Уроком ВБ: без посуточной истории нельзя ни доказать пропажу товара, ни
-- увидеть, что остаток замер.
create table if not exists public.ozon_stocks_history (
  snapshot_date date not null,
  product_id    bigint not null,
  stock_type    text not null check (stock_type in ('fbo', 'fbs')),
  offer_id      text not null,
  present       integer not null default 0,
  reserved      integer not null default 0,
  primary key (snapshot_date, product_id, stock_type)
);

comment on table public.ozon_stocks_history is
  'Посуточная история остатков Ozon. Первоисточник: по ней считаются дни запаса и пропажи.';

alter table public.ozon_products enable row level security;
alter table public.ozon_stocks enable row level security;
alter table public.ozon_stocks_history enable row level security;

-- Сводный взгляд: товар Ozon рядом со своим товаром в каталоге.
create or replace view public.v_ozon_stock_by_sku as
select
  p.offer_id,
  sc.id            as sku_id,
  sc.title,
  p.product_id,
  p.sku            as ozon_sku,
  p.archived,
  coalesce(sum(s.present) filter (where s.stock_type = 'fbo'), 0)  as fbo,
  coalesce(sum(s.present) filter (where s.stock_type = 'fbs'), 0)  as fbs,
  coalesce(sum(s.present), 0)                                      as vsego,
  coalesce(sum(s.reserved), 0)                                     as v_rezerve,
  max(s.fetched_at)                                                as fetched_at
from public.ozon_products p
left join public.ozon_stocks s on s.product_id = p.product_id
left join public.sku_catalog sc on sc.my_article = p.offer_id
group by p.offer_id, sc.id, sc.title, p.product_id, p.sku, p.archived;

comment on view public.v_ozon_stock_by_sku is
  'Товары Ozon с остатками ФБО и ФБС, связанные с каталогом по артикулу.';
