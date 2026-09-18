-- Оборачиваемость Ozon по товарам - предупреждение о платном хранении.
--
-- Правило владелицы 17.09.2026: «у Ozon сколько-то дней бесплатное хранение,
-- потом включается конское. Когда начинается платное - лучше скинуть товар
-- даже в минус».
--
-- Цифры это подтверждают. Сентябрь-октябрь 2025 хранение было нулевым, в
-- ноябре сразу 12 141 ₽ - это 27 % от того, что Ozon перечислил за месяц.
-- Декабрь 46 677 ₽. Всего за 11 месяцев 111 316 ₽, из них 84 601 ₽ за
-- ноябрь-январь, когда товар лежал и продавался медленно.
--
-- Источник: /v1/analytics/turnover/stocks. Найден перебором 17.09.2026,
-- документация Ozon из рабочей среды закрыта. Отдаёт по каждому товару:
-- остаток, продаж в день, оборачиваемость в днях и свою оценку. Именно по
-- оценке оборачиваемости Ozon и решает, сколько брать за хранение.
--
-- Чего этот метод НЕ даёт: рублей хранения по товару. Ozon отдаёт их только
-- общей суммой за неделю. Поэтому «деньги под риском» считаем как остаток
-- на себестоимость - это капитал, который лежит, а не счёт за хранение.

create table if not exists public.ozon_turnover (
  snapshot_date  date    not null default current_date,
  sku            bigint  not null,
  offer_id       text,
  name           text,
  current_stock  integer,
  ads            numeric,   -- средние продажи в день, как считает Ozon
  idc            numeric,   -- на сколько дней хватит остатка
  turnover       numeric,   -- оборачиваемость в днях
  idc_grade      text,
  turnover_grade text,
  fetched_at     timestamptz not null default now(),
  primary key (snapshot_date, sku)
);

comment on table public.ozon_turnover is
  'Оборачиваемость Ozon по товарам, снимок за день. По оценке оборачиваемости Ozon начисляет хранение.';
comment on column public.ozon_turnover.turnover_grade is
  'Оценка Ozon: GRADES_GREEN / YELLOW / RED / CRITICAL. CRITICAL - хранение будет дорогим.';

create index if not exists ozon_turnover_offer_idx on public.ozon_turnover (offer_id);

alter table public.ozon_turnover enable row level security;

-- Что лежит и грозит платным хранением - на последний снимок.
create or replace view public.v_ozon_zalezhi as
with posledniy as (
  select max(snapshot_date) as d from public.ozon_turnover
)
select
  t.snapshot_date,
  t.offer_id,
  coalesce(c.title, t.name) as tovar,
  t.current_stock as ostatok,
  t.ads as prodazh_v_den,
  t.turnover as oborachivaemost_dney,
  t.turnover_grade,
  case t.turnover_grade
    when 'GRADES_CRITICAL' then 'Хранение дорогое - скидывать'
    when 'GRADES_RED'      then 'Хранение дорожает - следить'
    when 'GRADES_YELLOW'   then 'На границе'
    when 'GRADES_GREEN'    then 'Нормально'
    else t.turnover_grade
  end as chto_delat,
  c.cost_price_rub,
  round(t.current_stock * c.cost_price_rub, 2) as dengi_pod_riskom
from public.ozon_turnover t
join posledniy p on p.d = t.snapshot_date
left join public.sku_catalog c on c.my_article = t.offer_id
where t.current_stock > 0
order by
  case t.turnover_grade
    when 'GRADES_CRITICAL' then 1
    when 'GRADES_RED' then 2
    when 'GRADES_YELLOW' then 3
    else 4
  end,
  t.current_stock * coalesce(c.cost_price_rub, 0) desc;

comment on view public.v_ozon_zalezhi is
  'Залежи Ozon: что лежит, как оборачивается и сколько денег в этом заперто.';
