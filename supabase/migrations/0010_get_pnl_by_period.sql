-- 0010_get_pnl_by_period.sql
-- Параметрические P&L-функции по периоду (from, to).
-- v_pnl_by_sku агрегирует за весь загруженный период — неудобно для сверок.
-- Эти функции принимают даты и считают то же самое за окно.

create or replace function get_pnl_by_period(p_from date, p_to date)
returns table (
  sku_id           bigint,
  my_article       text,
  wb_article       bigint,
  revenue_rub      numeric,
  commission_rub   numeric,
  logistics_rub    numeric,
  units_sold       numeric,
  cogs_rub         numeric,
  tax_rub          numeric,
  net_profit_rub   numeric,
  margin_pct       numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with rev as (
    select nm_id,
           sum(coalesce(retail_amount, 0)) as revenue_rub,
           sum(coalesce(quantity, 0))::numeric as units_sold
    from public.wb_reports_fact
    where doc_type_name = 'Продажа'
      and sale_dt::date between p_from and p_to
    group by nm_id
  ),
  com as (
    select nm_id, sum(coalesce(commission_rub, 0)) as commission_rub
    from public.wb_reports_fact
    where rr_dt::date between p_from and p_to
    group by nm_id
  ),
  log as (
    select nm_id, sum(coalesce(delivery_rub, 0)) as logistics_rub
    from public.wb_reports_fact
    where rr_dt::date between p_from and p_to
    group by nm_id
  )
  select
    s.id as sku_id,
    s.my_article,
    s.wb_article,
    coalesce(rev.revenue_rub, 0) as revenue_rub,
    coalesce(com.commission_rub, 0) as commission_rub,
    coalesce(log.logistics_rub, 0) as logistics_rub,
    coalesce(rev.units_sold, 0) as units_sold,
    coalesce(s.cost_price_rub, 0) * coalesce(rev.units_sold, 0) as cogs_rub,
    coalesce(rev.revenue_rub, 0) * public.app_setting_num('tax_rate') as tax_rub,
    coalesce(rev.revenue_rub, 0)
      - coalesce(com.commission_rub, 0)
      - coalesce(log.logistics_rub, 0)
      - coalesce(s.cost_price_rub, 0) * coalesce(rev.units_sold, 0)
      - coalesce(rev.revenue_rub, 0) * public.app_setting_num('tax_rate') as net_profit_rub,
    case when coalesce(rev.revenue_rub, 0) > 0
      then (coalesce(rev.revenue_rub, 0)
          - coalesce(com.commission_rub, 0)
          - coalesce(log.logistics_rub, 0)
          - coalesce(s.cost_price_rub, 0) * coalesce(rev.units_sold, 0)
          - coalesce(rev.revenue_rub, 0) * public.app_setting_num('tax_rate'))
          / rev.revenue_rub
      else null end as margin_pct
  from public.sku_catalog s
  left join rev on rev.nm_id = s.wb_article
  left join com on com.nm_id = s.wb_article
  left join log on log.nm_id = s.wb_article
  where coalesce(rev.revenue_rub, 0) > 0
     or coalesce(com.commission_rub, 0) <> 0
     or coalesce(log.logistics_rub, 0) > 0
  order by 10 desc nulls last;
$$;

comment on function get_pnl_by_period(date, date) is
  'P&L по SKU за период [from, to]. Только SKU с активностью за период.';

create or replace function get_pnl_totals(p_from date, p_to date)
returns table (
  revenue_rub     numeric,
  commission_rub  numeric,
  logistics_rub   numeric,
  units_sold      numeric,
  cogs_rub        numeric,
  tax_rub         numeric,
  net_profit_rub  numeric,
  margin_pct      numeric
)
language sql stable security invoker set search_path = '' as $$
  select
    sum(revenue_rub),
    sum(commission_rub),
    sum(logistics_rub),
    sum(units_sold),
    sum(cogs_rub),
    sum(tax_rub),
    sum(net_profit_rub),
    case when sum(revenue_rub) > 0 then sum(net_profit_rub)/sum(revenue_rub) else null end
  from public.get_pnl_by_period(p_from, p_to);
$$;

comment on function get_pnl_totals(date, date) is 'Свод P&L за период (одна строка).';
