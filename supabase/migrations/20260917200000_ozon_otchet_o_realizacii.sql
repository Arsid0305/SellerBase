-- Ozon, шаг третий: деньги. Отчёт о реализации по месяцам.
--
-- Метод транзакций, на который я рассчитывала (v3/finance/transaction/list),
-- Ozon погасил: отвечает «obsolete method cannot be used». Проверено перебором
-- 17.09.2026, документация из рабочей среды закрыта сетевым фильтром. Живой
-- источник денег - v2/finance/realization: помесячный отчёт о реализации с
-- разбивкой по товарам. Это прямой аналог отчёта реализации ВБ, по которому у
-- нас уже считается прибыль.
--
-- Строка отчёта (живой ответ за май 2026): цена продавца за штуку, количество,
-- сумма, комиссия, бонус, стандартная ставка, звёзды, софинансирование банка и
-- ПВЗ, компенсация, итог и доля комиссии. Возврат идёт отдельным блоком той же
-- формы. Держим все статьи по отдельности - складывать их в одну «комиссию»
-- нельзя, они разной природы.

create table if not exists public.ozon_realization (
  year        smallint not null,
  month       smallint not null check (month between 1 and 12),
  row_number  integer  not null,
  doc_number  text,
  doc_date    date,
  offer_id    text,
  sku         bigint,
  barcode     text,
  name        text,

  seller_price_per_instance numeric(14,2),
  commission_ratio          numeric(6,4),

  -- продажа
  sale_qty              integer,
  sale_price_per_instance numeric(14,2),
  sale_amount           numeric(14,2),
  sale_commission       numeric(14,2),
  sale_bonus            numeric(14,2),
  sale_standard_fee     numeric(14,2),
  sale_stars            numeric(14,2),
  sale_bank_coinvest    numeric(14,2),
  sale_pvz_coinvest     numeric(14,2),
  sale_compensation     numeric(14,2),
  sale_total            numeric(14,2),

  -- возврат
  ret_qty         integer,
  ret_amount      numeric(14,2),
  ret_commission  numeric(14,2),
  ret_total       numeric(14,2),

  raw        jsonb,
  fetched_at timestamptz not null default now(),
  primary key (year, month, row_number)
);

create index if not exists ozon_realization_offer_idx on public.ozon_realization (offer_id);
create index if not exists ozon_realization_period_idx on public.ozon_realization (year, month);

comment on table public.ozon_realization is
  'Отчёт о реализации Ozon по месяцам, строки по товарам. Аналог отчёта реализации ВБ. Источник денег по Ozon: комиссия, бонусы, ставка, итог.';

alter table public.ozon_realization enable row level security;

create or replace view public.v_ozon_money_by_sku as
select
  r.year, r.month, r.offer_id, sc.id as sku_id, sc.title,
  sum(coalesce(r.sale_qty, 0))            as sht,
  sum(coalesce(r.sale_amount, 0))         as vyruchka,
  sum(coalesce(r.sale_commission, 0))     as komissiya,
  sum(coalesce(r.sale_bonus, 0))          as bonusy,
  sum(coalesce(r.sale_standard_fee, 0))   as stavka,
  sum(coalesce(r.sale_total, 0))          as k_vyplate,
  sum(coalesce(r.ret_qty, 0))             as vozvratov_sht,
  sum(coalesce(r.ret_total, 0))           as vozvraty_summa
from public.ozon_realization r
left join public.sku_catalog sc on sc.my_article = r.offer_id
group by r.year, r.month, r.offer_id, sc.id, sc.title;

comment on view public.v_ozon_money_by_sku is
  'Деньги Ozon по товарам и месяцам, связанные с каталогом по артикулу.';
