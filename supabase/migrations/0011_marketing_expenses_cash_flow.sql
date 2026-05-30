-- 0011_marketing_expenses_cash_flow.sql
-- Внешний маркетинг (не WB-реклама) + общий cash flow.
-- Заполняются вручную через UI / Supabase Studio.

------------------------------------------------------------
-- 1. marketing_expenses
------------------------------------------------------------
create table if not exists marketing_expenses (
  id          bigserial primary key,
  expense_dt  date        not null,
  channel     text        not null,
  amount_rub  numeric(14,2) not null check (amount_rub >= 0),
  sku_id      bigint      references sku_catalog(id) on delete set null,
  comment     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ix_marketing_expenses_dt on marketing_expenses(expense_dt);
create index if not exists ix_marketing_expenses_sku on marketing_expenses(sku_id);
create index if not exists ix_marketing_expenses_channel on marketing_expenses(channel);

alter table marketing_expenses enable row level security;

comment on table marketing_expenses is
  'Расходы на маркетинг вне WB API. channel: blogger/vk_ads/ya_ads/reviews/photo/packaging/other. sku_id null = общий бренд-маркетинг.';

------------------------------------------------------------
-- 2. cash_flow
------------------------------------------------------------
create table if not exists cash_flow (
  id          bigserial primary key,
  flow_dt     date        not null,
  direction   text        not null check (direction in ('in', 'out')),
  category    text        not null,
  amount_rub  numeric(14,2) not null check (amount_rub >= 0),
  comment     text,
  related_china_order_id bigint references china_orders(id) on delete set null,
  related_cargo_shipment_id bigint references cargo_shipments(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ix_cash_flow_dt on cash_flow(flow_dt);
create index if not exists ix_cash_flow_direction on cash_flow(direction);
create index if not exists ix_cash_flow_category on cash_flow(category);

alter table cash_flow enable row level security;

comment on table cash_flow is
  'Финансовые движения вне выручки WB. direction: in (приход) / out (расход).';

------------------------------------------------------------
-- 3. Триггеры updated_at
------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_marketing_updated_at on marketing_expenses;
create trigger trg_marketing_updated_at
  before update on marketing_expenses
  for each row execute function set_updated_at();

drop trigger if exists trg_cash_flow_updated_at on cash_flow;
create trigger trg_cash_flow_updated_at
  before update on cash_flow
  for each row execute function set_updated_at();

------------------------------------------------------------
-- 4. get_full_pnl_by_period — P&L с учётом внешнего маркетинга
------------------------------------------------------------
create or replace function get_full_pnl_by_period(p_from date, p_to date)
returns table (
  sku_id             bigint,
  my_article         text,
  wb_article         bigint,
  revenue_rub        numeric,
  commission_rub     numeric,
  logistics_rub      numeric,
  units_sold         numeric,
  cogs_rub           numeric,
  marketing_rub      numeric,
  tax_rub            numeric,
  net_profit_rub     numeric,
  margin_pct         numeric
)
language sql stable security invoker set search_path = '' as $$
  with base as (
    select * from public.get_pnl_by_period(p_from, p_to)
  ),
  mkt as (
    select sku_id, sum(amount_rub) as marketing_rub
    from public.marketing_expenses
    where expense_dt between p_from and p_to
      and sku_id is not null
    group by sku_id
  )
  select
    b.sku_id, b.my_article, b.wb_article,
    b.revenue_rub, b.commission_rub, b.logistics_rub, b.units_sold,
    b.cogs_rub,
    coalesce(m.marketing_rub, 0) as marketing_rub,
    b.tax_rub,
    b.net_profit_rub - coalesce(m.marketing_rub, 0) as net_profit_rub,
    case when b.revenue_rub > 0
      then (b.net_profit_rub - coalesce(m.marketing_rub, 0)) / b.revenue_rub
      else null end as margin_pct
  from base b
  left join mkt m on m.sku_id = b.sku_id
  order by 11 desc nulls last;
$$;

comment on function get_full_pnl_by_period(date, date) is
  'P&L по SKU за период с вычетом внешнего маркетинга (marketing_expenses).';

------------------------------------------------------------
-- 5. v_cash_flow_by_month
------------------------------------------------------------
create or replace view v_cash_flow_by_month
with (security_invoker = on) as
  select
    date_trunc('month', flow_dt)::date as month,
    direction,
    category,
    sum(amount_rub) as total_rub,
    count(*) as count
  from cash_flow
  group by 1, 2, 3
  order by 1 desc, 2, 3;

comment on view v_cash_flow_by_month is
  'Свод денежных потоков по месяцам/направлению/категории.';
