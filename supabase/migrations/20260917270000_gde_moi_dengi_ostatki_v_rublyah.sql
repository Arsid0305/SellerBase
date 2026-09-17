-- «Где мои деньги» - остатки в рублях по себестоимости, одной таблицей.
--
-- Просьба владелицы 17.09.2026: видеть в программе текущей эту сводку.
-- До этого мёртвых денег в программе не было видно нигде: когда живым
-- складом ВБ остался один, остальные ушли из остатков и больше никуда не
-- попали. Заморожённые 866 019 ₽ просто исчезли из вида - моя недоделка.
--
-- Строки и их порядок - как в таблице, которую владелица прислала:
--   Лежит для продажи (склад WB РФ + Ozon)
--   В пути (едет покупателям + возвраты, зависшие)
--   Заморожено на мёртвых складах
--   Потеряно (пропало без продажи)
--
-- Зависшие возвраты держим строкой внутри «В пути», а не в «Заморожено»:
-- формально они в пути, по факту не двигаются. Видно и то, и другое.
--
-- «Потеряно» считается от того дня, когда живым складом стал один
-- (16.08.2026) - раньше ряд разорван и разница склада ничего не значит.
-- Дата не вписана руками, а берётся как первый день склада WB РФ в истории.
--
-- ⚠️ «Потеряно» будет дёргаться: продажи попадают в отчёт ВБ с
-- запозданием, и часть этой цифры - не потеря, а неприехавший отчёт.
-- Поэтому у строки стоит пометка, а не голое число.

create or replace view public.v_stock_money as
with den as (
  select max(snapshot_date) as d from public.wb_stocks_history
),
nachalo as (
  -- Первый день, когда живым складом ВБ стал один. От него считаем потери.
  select min(snapshot_date) as d
  from public.wb_stocks_history
  where warehouse_name = 'Склад WB РФ'
),
segodnya as (
  select h.warehouse_name, h.nm_id, h.quantity
  from public.wb_stocks_history h, den
  where h.snapshot_date = den.d
),
-- ВБ, живой склад
wb_zhivoy as (
  select coalesce(sum(s.quantity), 0) as sht,
         coalesce(sum(s.quantity * c.cost_price_rub), 0) as rub
  from segodnya s
  left join public.sku_catalog c on c.wb_article = s.nm_id
  where s.warehouse_name = 'Склад WB РФ'
),
-- Ozon, что лежит на его складе
ozon_zhivoy as (
  select coalesce(sum(o.present), 0) as sht,
         coalesce(sum(o.present * c.cost_price_rub), 0) as rub
  from public.ozon_stocks o
  left join public.sku_catalog c on c.my_article = o.offer_id
  where o.present > 0
),
k_pokupatelyam as (
  select coalesce(sum(s.quantity), 0) as sht,
         coalesce(sum(s.quantity * c.cost_price_rub), 0) as rub
  from segodnya s
  left join public.sku_catalog c on c.wb_article = s.nm_id
  where s.warehouse_name = 'В пути до получателей'
),
vozvraty as (
  select coalesce(sum(s.quantity), 0) as sht,
         coalesce(sum(s.quantity * c.cost_price_rub), 0) as rub
  from segodnya s
  left join public.sku_catalog c on c.wb_article = s.nm_id
  where s.warehouse_name = 'В пути возвраты на склад WB'
),
-- С какого дня возвраты стоят: начало текущего сидения, а не первого в истории
vozvraty_po_dnyam as (
  select h.snapshot_date d, sum(h.quantity) q
  from public.wb_stocks_history h
  where h.warehouse_name = 'В пути возвраты на склад WB'
  group by 1
),
vozvraty_s as (
  select min(d) as d from vozvraty_po_dnyam
  where q > 100
    and d > coalesce((select max(d) from vozvraty_po_dnyam where q <= 100), '1900-01-01'::date)
),
zamorozheno as (
  select coalesce(sum(s.quantity), 0) as sht,
         coalesce(sum(s.quantity * c.cost_price_rub), 0) as rub
  from segodnya s
  join public.wb_stock_service_rows sr
    on sr.warehouse_name = s.warehouse_name and sr.kind = 'frozen'
  left join public.sku_catalog c on c.wb_article = s.nm_id
),
-- Потеряно: со склада ушло, но не продано и не уехало покупателям
poteri as (
  select
    coalesce((select sum(h.quantity) from public.wb_stocks_history h, nachalo n
              where h.warehouse_name = 'Склад WB РФ' and h.snapshot_date = n.d), 0) as sklad_start,
    (select sht from wb_zhivoy) as sklad_end,
    coalesce((select sum(f.quantity) from public.wb_reports_fact f, nachalo n, den
              where f.rr_dt between n.d and den.d and f.doc_type_name = 'Продажа'), 0) as prodano,
    coalesce((select sum(h.quantity) from public.wb_stocks_history h, den
              where h.warehouse_name = 'В пути до получателей' and h.snapshot_date = den.d), 0)
    - coalesce((select sum(h.quantity) from public.wb_stocks_history h, nachalo n
              where h.warehouse_name = 'В пути до получателей' and h.snapshot_date = n.d), 0) as uehalo
),
poteryano as (
  select
    greatest(p.sklad_start - p.sklad_end - p.prodano - greatest(p.uehalo, 0), 0) as sht,
    round(greatest(p.sklad_start - p.sklad_end - p.prodano - greatest(p.uehalo, 0), 0)
          * case when w.sht > 0 then w.rub / w.sht else 0 end) as rub
  from poteri p, wb_zhivoy w
)
select 1 as poryadok, 'itog' as vid, 'Лежит для продажи' as stroka,
       (select sht from wb_zhivoy) + (select sht from ozon_zhivoy) as shtuk,
       round((select rub from wb_zhivoy) + (select rub from ozon_zhivoy)) as rublei,
       null::text as pometka
union all
select 2, 'stroka', 'Склад WB РФ', (select sht from wb_zhivoy),
       round((select rub from wb_zhivoy)), null
union all
select 3, 'stroka', 'Ozon', (select sht from ozon_zhivoy),
       round((select rub from ozon_zhivoy)), null
union all
select 4, 'itog', 'В пути',
       (select sht from k_pokupatelyam) + (select sht from vozvraty),
       round((select rub from k_pokupatelyam) + (select rub from vozvraty)), null
union all
select 5, 'stroka', 'Едет покупателям', (select sht from k_pokupatelyam),
       round((select rub from k_pokupatelyam)), null
union all
select 6, 'stroka', 'Возвраты, зависли', (select sht from vozvraty),
       round((select rub from vozvraty)),
       case when (select d from vozvraty_s) is null then null
            else 'не двигаются ' || ((select d from den) - (select d from vozvraty_s)) || ' дн.'
       end
union all
select 7, 'itog', 'Заморожено на мёртвых складах', (select sht from zamorozheno),
       round((select rub from zamorozheno)),
       'с ' || to_char((select d from nachalo), 'DD.MM.YYYY')
union all
select 8, 'itog', 'Потеряно', (select sht from poteryano),
       (select rub from poteryano),
       'пропало без продажи с ' || to_char((select d from nachalo), 'DD.MM.YYYY')
         || ', уточняется по отчёту ВБ'
order by poryadok;

comment on view public.v_stock_money is
  'Остатки в рублях по себестоимости: в продаже, в пути, заморожено, потеряно. Строки как в таблице владелицы.';
