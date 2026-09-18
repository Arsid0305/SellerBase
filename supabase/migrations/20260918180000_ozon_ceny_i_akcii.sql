-- Шаг четвёртый Ozon: цены, тарифы площадки и акции.
--
-- Главный вопрос шага был записан в docs/integrations/OZON_PODKLYUCHENIE.md:
-- отдаёт ли Ozon комиссию и логистику прямо по каждому товару. От ответа
-- зависело, можно ли делать симулятор цены по Ozon сразу или ждать разбора
-- финансовых отчётов.
--
-- Проверено 18.09.2026 живым запросом: отдаёт. Метод /v5/product/info/prices
-- по каждому товару возвращает и цену, и процент комиссии, и логистику в
-- рублях, и эквайринг. Значит путь быстрый.
--
-- Цифра, ради которой всё это заводится: комиссия Ozon по текущим тарифам
-- 52 % от цены. В отчётах реализации за март-апрель 2026 стояло 37-40 %.
-- Тариф вырос, и без этой таблицы рост нигде не виден.
--
-- На площадку не пишем ничего: у ключа права «Admin read only».

-- ── 1. Цены и тарифы площадки по товару ─────────────────────────────────
create table if not exists public.ozon_prices (
  product_id                bigint primary key,
  offer_id                  text,
  price                     numeric,  -- цена, по которой товар продаётся сейчас
  old_price                 numeric,  -- зачёркнутая цена
  min_price                 numeric,  -- минимальная цена, ниже которой не опускать
  marketing_seller_price    numeric,  -- цена с учётом скидок за счёт продавца
  currency_code             text,
  acquiring                 numeric,  -- эквайринг в рублях за продажу
  volume_weight             numeric,
  -- комиссия в процентах, отдельно по моделям
  commission_pct_fbo        numeric,
  commission_pct_fbs        numeric,
  -- логистика в рублях
  fbo_logistika_min         numeric,
  fbo_logistika_max         numeric,
  fbo_dostavka_pokupatelyu  numeric,
  fbo_obratnaya_logistika   numeric,
  fbs_logistika_min         numeric,
  fbs_logistika_max         numeric,
  fbs_dostavka_pokupatelyu  numeric,
  fbs_pervaya_milya_max     numeric,
  fbs_obratnaya_logistika   numeric,
  -- индекс цены: как Ozon оценивает цену против других площадок
  index_cvet                text,
  index_vneshnyaya_min      numeric,
  index_drugie_ploshchadki  numeric,
  avtoakcii_vklyucheny      boolean,
  uchastvuet_v_akciyah      boolean,
  raw                       jsonb,
  fetched_at                timestamptz not null default now()
);

comment on table public.ozon_prices is
  'Цены Ozon и тарифы площадки по каждому товару. Текущий срез, обновляется дважды в день.';
comment on column public.ozon_prices.commission_pct_fbo is
  'Процент комиссии Ozon за продажу со склада Ozon. По тарифам 18.09.2026 - 52 %.';
comment on column public.ozon_prices.index_cvet is
  'Индекс цены Ozon: WITHOUT_INDEX / GREEN / YELLOW / RED. Жёлтый и красный - Ozon считает цену завышенной и хуже показывает товар.';
comment on column public.ozon_prices.min_price is
  'Минимальная цена продавца. Ozon не опускает цену ниже неё в своих акциях.';

create index if not exists ozon_prices_offer_idx on public.ozon_prices (offer_id);
alter table public.ozon_prices enable row level security;

-- ── 2. История цен ──────────────────────────────────────────────────────
-- Зачем: без истории нельзя ни увидеть, что цену уронила акция, ни доказать,
-- что товар месяц стоял с жёлтым индексом. Урок ВБ - без посуточной записи
-- пропажу заметили через месяц.
create table if not exists public.ozon_prices_history (
  snapshot_date          date   not null default current_date,
  product_id             bigint not null,
  offer_id               text,
  price                  numeric,
  old_price              numeric,
  min_price              numeric,
  marketing_seller_price numeric,
  index_cvet             text,
  primary key (snapshot_date, product_id)
);

comment on table public.ozon_prices_history is
  'История цен Ozon по дням. Показывает, как менялась цена и индекс.';

create index if not exists ozon_prices_history_offer_idx on public.ozon_prices_history (offer_id);
alter table public.ozon_prices_history enable row level security;

-- ── 3. Акции Ozon ───────────────────────────────────────────────────────
create table if not exists public.ozon_actions (
  action_id           bigint primary key,
  title               text,
  action_type         text,
  date_start          timestamptz,
  date_end            timestamptz,
  freeze_date         text,
  uchastvuem          boolean,   -- участвуем ли сейчас
  tovarov_uchastvuet  integer,
  tovarov_mozhno      integer,   -- сколько товаров подходит, но не заведено
  tovarov_zapreshcheno integer,
  discount_type       text,
  discount_value      numeric,
  opisanie            text,
  fetched_at          timestamptz not null default now()
);

comment on table public.ozon_actions is
  'Акции Ozon: какие идут, участвуем ли, сколько товаров заведено и сколько ещё подходит.';
comment on column public.ozon_actions.tovarov_mozhno is
  'Сколько товаров Ozon предлагает добавить в акцию. Больше нуля - есть что завести.';

alter table public.ozon_actions enable row level security;

-- ── 4. Товары в акциях ──────────────────────────────────────────────────
create table if not exists public.ozon_action_products (
  action_id       bigint not null,
  product_id      bigint not null,
  offer_id        text,
  akcionnaya_cena numeric,
  max_cena_akcii  numeric,  -- выше этой цены Ozon в акцию не пустит
  ostatok         integer,
  dobavlen_kak    text,     -- вручную или автоматически
  fetched_at      timestamptz not null default now(),
  primary key (action_id, product_id)
);

comment on table public.ozon_action_products is
  'Товары, заведённые в акции Ozon, и цена по акции.';

create index if not exists ozon_action_products_offer_idx on public.ozon_action_products (offer_id);
alter table public.ozon_action_products enable row level security;

-- ── 5. Что останется с продажи ──────────────────────────────────────────
-- Считаем по тарифам, которые Ozon отдаёт сам по каждому товару, а не по
-- средним из отчётов. Логистику берём по нижней границе: Ozon даёт вилку
-- (например 63-169 ₽), и нижняя граница - оптимистичный край. Значит
-- настоящая прибыль будет не больше посчитанной здесь, но может быть меньше.
create or replace view public.v_ozon_ekonomika_ceny as
select
  p.offer_id,
  coalesce(c.title, p.offer_id)                      as tovar,
  p.price                                            as cena,
  p.old_price                                        as cena_zachyorknutaya,
  p.min_price                                        as min_cena_prodavca,
  p.index_cvet,
  p.commission_pct_fbo,
  round(p.price * p.commission_pct_fbo / 100, 2)     as komissiya_rub,
  p.fbo_logistika_min                                as logistika_rub,
  p.fbo_dostavka_pokupatelyu                         as dostavka_rub,
  p.acquiring                                        as ekvayring_rub,
  round(
    p.price * p.commission_pct_fbo / 100
    + coalesce(p.fbo_logistika_min, 0)
    + coalesce(p.fbo_dostavka_pokupatelyu, 0)
    + coalesce(p.acquiring, 0), 2)                   as zaberyot_ozon,
  round(
    p.price
    - p.price * p.commission_pct_fbo / 100
    - coalesce(p.fbo_logistika_min, 0)
    - coalesce(p.fbo_dostavka_pokupatelyu, 0)
    - coalesce(p.acquiring, 0), 2)                   as ostanetsya,
  c.cost_price_rub                                   as sebestoimost,
  round(
    p.price
    - p.price * p.commission_pct_fbo / 100
    - coalesce(p.fbo_logistika_min, 0)
    - coalesce(p.fbo_dostavka_pokupatelyu, 0)
    - coalesce(p.acquiring, 0)
    - coalesce(c.cost_price_rub, 0), 2)              as pribyl,
  case when p.price > 0 then round((
    p.price
    - p.price * p.commission_pct_fbo / 100
    - coalesce(p.fbo_logistika_min, 0)
    - coalesce(p.fbo_dostavka_pokupatelyu, 0)
    - coalesce(p.acquiring, 0)
    - coalesce(c.cost_price_rub, 0)) / p.price * 100, 1) end as marzha_pct,
  p.fetched_at
from public.ozon_prices p
left join public.sku_catalog c on c.my_article = p.offer_id
where p.price > 0;

comment on view public.v_ozon_ekonomika_ceny is
  'Сколько Ozon заберёт с продажи и что останется. Тарифы - по каждому товару от самой площадки, логистика по нижней границе вилки.';

-- ── 6. Где с ценой беда ─────────────────────────────────────────────────
create or replace view public.v_ozon_ceny_problemy as
select
  e.offer_id,
  e.tovar,
  e.cena,
  e.sebestoimost,
  e.pribyl,
  e.marzha_pct,
  e.index_cvet,
  case
    when e.sebestoimost is null              then 'Нет себестоимости - прибыль не посчитать'
    when e.pribyl < 0                        then 'Продажа в убыток'
    when e.marzha_pct < 10                   then 'Маржа меньше 10 %'
    when e.index_cvet in ('RED', 'YELLOW')   then 'Ozon считает цену завышенной - хуже показывает товар'
    when e.cena < e.min_cena_prodavca        then 'Цена ниже собственной минимальной'
  end as chto_ne_tak
from public.v_ozon_ekonomika_ceny e
where e.sebestoimost is null
   or e.pribyl < 0
   or e.marzha_pct < 10
   or e.index_cvet in ('RED', 'YELLOW')
   or e.cena < e.min_cena_prodavca;

comment on view public.v_ozon_ceny_problemy is
  'Товары Ozon, где цена работает против нас: убыток, тонкая маржа или плохой индекс цены.';

-- Права: представления читает только серверная часть служебным ключом.
alter view public.v_ozon_ekonomika_ceny set (security_invoker = on);
alter view public.v_ozon_ceny_problemy  set (security_invoker = on);
revoke select on public.v_ozon_ekonomika_ceny from anon;
revoke select on public.v_ozon_ceny_problemy  from anon;
revoke insert, update, delete, truncate on public.v_ozon_ekonomika_ceny from anon, authenticated;
revoke insert, update, delete, truncate on public.v_ozon_ceny_problemy  from anon, authenticated;
