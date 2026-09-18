-- Остатки и оборачиваемость по артикулам на обеих площадках.
--
-- Согласовано с владелицей 17.09.2026. Колонки - её список с двумя
-- поправками, которые она приняла: ФБС одним числом (а не по площадкам,
-- потому что это одна куча) и «мёртвое» отдельной колонкой, чтобы видеть,
-- в каких именно артикулах заперты деньги.
--
-- Правило, которое здесь соблюдается буквально: «ничего выдумывать не надо.
-- Если не было продаж просто пишешь не было продаж». Поэтому «хватит на
-- дней» - null там, где продаж не было. Ноль в этом месте был бы враньём:
-- ноль дней значит «кончилось завтра», а на деле «не продаётся вообще».
--
-- ФБС берём как большее из заявленного двум площадкам. Обоснование: число
-- должно быть одно и то же, и если они разошлись - на складе лежит не
-- меньше большего. Само расхождение показывает v_fbs_stock_match, и оно
-- выносится отдельной тревогой, а не прячется в столбце.
--
-- Мёртвое в оборачиваемость не входит: замороженное и зависшее не продаётся,
-- делить его на скорость продаж бессмысленно.

create or replace view public.v_stock_by_article as
with den as (
  select max(snapshot_date) as d from public.wb_stocks_history
),
vb_fbo as (
  select h.nm_id, sum(h.quantity) as sht
  from public.wb_stocks_history h
  where h.snapshot_date = (select d from den) and h.warehouse_name = 'Склад WB РФ'
  group by 1
),
vb_mertvoe as (
  select h.nm_id, sum(h.quantity) as sht
  from public.wb_stocks_history h
  join public.wb_stock_service_rows sr on sr.warehouse_name = h.warehouse_name
  where h.snapshot_date = (select d from den)
    and sr.kind in ('frozen', 'in_transit_from_client')
  group by 1
),
oz_fbo as (
  select o.offer_id, sum(o.present) as sht
  from public.ozon_stocks o where o.stock_type = 'fbo' group by 1
),
oz_fbs as (
  select o.offer_id, sum(o.present) as sht
  from public.ozon_stocks o where o.stock_type = 'fbs' group by 1
),
vb_fbs as (
  select s.barcode, sum(s.amount) as sht
  from public.wb_fbs_stocks s
  where s.snapshot_date = (select max(snapshot_date) from public.wb_fbs_stocks)
  group by 1
),
vb_prodazhi as (
  select s.nm_id, count(*)::numeric as sht
  from public.wb_sales_fact s
  where s.sale_dt >= current_date - 28 and not coalesce(s.is_storno, false)
  group by 1
),
oz_prodazhi as (
  select i.offer_id, sum(i.quantity)::numeric as sht
  from public.ozon_posting_items i
  join public.ozon_postings p on p.posting_number = i.posting_number
  where p.created_at >= current_date - 28
    and coalesce(p.status, '') <> 'cancelled'
  group by 1
)
select
  c.my_article as artikul,
  c.title      as tovar,
  coalesce(vfbo.sht, 0) as vb_fbo,
  coalesce(ofbo.sht, 0) as ozon_fbo,
  greatest(coalesce(vfbs.sht, 0), coalesce(ofbs.sht, 0)) as fbs,
  coalesce(vfbo.sht, 0) + coalesce(ofbo.sht, 0)
    + greatest(coalesce(vfbs.sht, 0), coalesce(ofbs.sht, 0)) as vsego,
  coalesce(vm.sht, 0) as mertvoe,
  case when coalesce(vp.sht, 0) > 0
       then round(coalesce(vfbo.sht, 0) / (vp.sht / 28.0), 0) end as dney_vb,
  case when coalesce(op.sht, 0) > 0
       then round(coalesce(ofbo.sht, 0) / (op.sht / 28.0), 0) end as dney_ozon,
  case when coalesce(vp.sht, 0) + coalesce(op.sht, 0) > 0
       then round(
         (coalesce(vfbo.sht, 0) + coalesce(ofbo.sht, 0)
          + greatest(coalesce(vfbs.sht, 0), coalesce(ofbs.sht, 0)))
         / ((coalesce(vp.sht, 0) + coalesce(op.sht, 0)) / 28.0), 0) end as dney_vsego,
  coalesce(vp.sht, 0) as prodazh_vb_28,
  coalesce(op.sht, 0) as prodazh_ozon_28,
  c.cost_price_rub
from public.sku_catalog c
left join vb_fbo      vfbo on vfbo.nm_id    = c.wb_article
left join vb_mertvoe  vm   on vm.nm_id      = c.wb_article
left join oz_fbo      ofbo on ofbo.offer_id = c.my_article
left join oz_fbs      ofbs on ofbs.offer_id = c.my_article
left join vb_fbs      vfbs on vfbs.barcode  = c.barcode
left join vb_prodazhi vp   on vp.nm_id      = c.wb_article
left join oz_prodazhi op   on op.offer_id   = c.my_article
where c.is_active
  and (coalesce(vfbo.sht, 0) + coalesce(ofbo.sht, 0) + coalesce(vfbs.sht, 0)
       + coalesce(ofbs.sht, 0) + coalesce(vm.sht, 0) > 0
       or coalesce(vp.sht, 0) + coalesce(op.sht, 0) > 0);

comment on view public.v_stock_by_article is
  'Остатки и оборачиваемость по артикулам: ВБ, Ozon, ФБС, мёртвое. Пусто в днях - продаж не было.';
