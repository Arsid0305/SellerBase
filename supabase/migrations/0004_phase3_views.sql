-- Phase 3: расчётные view. Маленькие → большие.
-- Все вью с security_invoker=on — права проверяются по вызывающему, не по создателю.

create or replace view v_revenue_by_sku
with (security_invoker = on) as
select
  nm_id,
  date_trunc('day', sale_dt)::date as day,
  sum(coalesce(retail_amount, 0)) as revenue_rub,
  sum(coalesce(quantity, 0))      as units_sold
from wb_reports_fact
where doc_type_name = 'Продажа'
group by nm_id, date_trunc('day', sale_dt)::date;

create or replace view v_commissions_by_sku
with (security_invoker = on) as
select
  nm_id,
  date_trunc('day', rr_dt)::date as day,
  sum(coalesce(commission_rub, 0)) as commission_rub
from wb_reports_fact
group by nm_id, date_trunc('day', rr_dt)::date;

create or replace view v_logistics_by_sku
with (security_invoker = on) as
select
  nm_id,
  date_trunc('day', rr_dt)::date as day,
  sum(coalesce(delivery_rub, 0)) as logistics_rub
from wb_reports_fact
group by nm_id, date_trunc('day', rr_dt)::date;

create or replace view v_sales_velocity
with (security_invoker = on) as
with window_days as (select greatest(1, app_setting_num('sales_velocity_window')::int) as n)
select
  r.nm_id,
  sum(coalesce(r.quantity, 0))::numeric / (select n from window_days) as units_per_day,
  (select n from window_days) as window_days
from wb_reports_fact r
where r.doc_type_name = 'Продажа'
  and r.sale_dt >= now() - ((select n from window_days) || ' days')::interval
group by r.nm_id;

create or replace view v_pnl_by_sku
with (security_invoker = on) as
select
  s.id              as sku_id,
  s.my_article,
  s.wb_article,
  coalesce(rev.revenue_rub, 0)        as revenue_rub,
  coalesce(com.commission_rub, 0)     as commission_rub,
  coalesce(log.logistics_rub, 0)      as logistics_rub,
  coalesce(rev.units_sold, 0)         as units_sold,
  coalesce(s.cost_price_rub, 0) * coalesce(rev.units_sold, 0) as cogs_rub,
  coalesce(rev.revenue_rub, 0) * app_setting_num('tax_rate') as tax_rub,
  coalesce(rev.revenue_rub, 0)
    - coalesce(com.commission_rub, 0)
    - coalesce(log.logistics_rub, 0)
    - coalesce(s.cost_price_rub, 0) * coalesce(rev.units_sold, 0)
    - coalesce(rev.revenue_rub, 0) * app_setting_num('tax_rate')                       as net_profit_rub,
  case when coalesce(rev.revenue_rub, 0) > 0 then
    (coalesce(rev.revenue_rub, 0)
      - coalesce(com.commission_rub, 0)
      - coalesce(log.logistics_rub, 0)
      - coalesce(s.cost_price_rub, 0) * coalesce(rev.units_sold, 0)
      - coalesce(rev.revenue_rub, 0) * app_setting_num('tax_rate')
    ) / rev.revenue_rub
  end as margin_pct
from sku_catalog s
left join (select nm_id, sum(revenue_rub) revenue_rub, sum(units_sold) units_sold from v_revenue_by_sku group by nm_id) rev on rev.nm_id = s.wb_article
left join (select nm_id, sum(commission_rub) commission_rub from v_commissions_by_sku group by nm_id) com on com.nm_id = s.wb_article
left join (select nm_id, sum(logistics_rub)  logistics_rub  from v_logistics_by_sku   group by nm_id) log on log.nm_id = s.wb_article;

create or replace view v_warehouses_balance
with (security_invoker = on) as
select
  s.id           as sku_id,
  s.my_article,
  s.wb_article,
  st.warehouse_name,
  st.quantity,
  st.in_way_to_client,
  st.in_way_from_client,
  v.units_per_day,
  case when coalesce(v.units_per_day, 0) > 0 then (st.quantity::numeric / v.units_per_day) end as days_to_oos
from sku_catalog s
join wb_stocks st on st.barcode = s.barcode
left join v_sales_velocity v on v.nm_id = s.wb_article;

create or replace view v_turnover
with (security_invoker = on) as
select
  sku_id,
  my_article,
  wb_article,
  sum(quantity) as total_stock,
  units_per_day,
  case when coalesce(units_per_day, 0) > 0 then sum(quantity)::numeric / units_per_day end as days_to_oos_total
from v_warehouses_balance
group by sku_id, my_article, wb_article, units_per_day;

create or replace view v_supply_recommendation
with (security_invoker = on) as
select
  t.sku_id,
  t.my_article,
  t.wb_article,
  t.units_per_day,
  t.total_stock,
  app_setting_num('china_lead_time_days') as lead_time_days,
  app_setting_num('safety_stock_days')    as safety_stock_days,
  greatest(
    0,
    coalesce(t.units_per_day, 0) * (app_setting_num('china_lead_time_days') + app_setting_num('safety_stock_days'))
      - coalesce(t.total_stock, 0)
  )::int as units_to_order
from v_turnover t;

create or replace view v_ads_roi
with (security_invoker = on) as
select
  nm_id,
  null::numeric as ads_spend_rub,
  null::numeric as drr,
  null::numeric as roas
from wb_reports_fact
where false;

create or replace view v_data_quality
with (security_invoker = on) as
  select 'sku_no_barcode'   as check_name, s.my_article::text as ref, 'СКУ без штрихкода'::text as detail
  from sku_catalog s where s.is_active and (s.barcode is null or s.barcode = '')
union all
  select 'sku_no_cost'      as check_name, s.my_article::text, 'Активный SKU без себестоимости'::text
  from sku_catalog s where s.is_active and (s.cost_price_rub is null or s.cost_price_rub = 0)
union all
  select 'negative_margin'  as check_name, p.my_article::text, ('Отрицательная маржа при выручке ' || p.revenue_rub)::text
  from v_pnl_by_sku p where p.revenue_rub > 0 and p.net_profit_rub < 0
union all
  select 'low_margin'       as check_name, p.my_article::text, ('Маржа ' || round(p.margin_pct * 100, 1) || '% ниже целевой')::text
  from v_pnl_by_sku p where p.revenue_rub > 0 and p.margin_pct < app_setting_num('target_margin')
union all
  select 'oos_soon'         as check_name, t.my_article::text, ('Остаток на ' || round(t.days_to_oos_total, 1) || ' дней')::text
  from v_turnover t where t.days_to_oos_total is not null and t.days_to_oos_total < app_setting_num('safety_stock_days')
union all
  select 'ingestion_error'  as check_name, l.job_name::text, ('Последний запуск с ошибкой: ' || coalesce(l.error_text, ''))::text
  from ingestion_log l
  where l.status = 'error'
    and l.started_at = (select max(started_at) from ingestion_log l2 where l2.job_name = l.job_name);
