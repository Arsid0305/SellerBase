-- Phase 4: Модуль «Закупки Китай → Себестоимость».
-- Структура 1:1 с Excel-файлом «Заказ Китай + Расчёт стоимости и веса».

create table if not exists china_orders (
  id            bigserial primary key,
  order_date    date not null,
  supplier_name text,
  status        text not null default 'draft',
  cny_rate      numeric(10,4),
  comment       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists china_order_items (
  id              bigserial primary key,
  order_id        bigint not null references china_orders(id) on delete cascade,
  sku_id          bigint references sku_catalog(id) on delete set null,
  supplier_url    text,
  comment         text,
  qty_ordered     integer not null default 0,
  price_yuan      numeric(12,2),
  sum_yuan        numeric(14,2) generated always as (qty_ordered * coalesce(price_yuan,0)) stored,
  delivery_yuan   numeric(12,2),
  qty_shipped     integer,
  unit_weight_kg  numeric(10,3),
  total_weight_kg numeric(12,3) generated always as (coalesce(qty_shipped,0) * coalesce(unit_weight_kg,0)) stored,
  package_norm    integer,
  box_size        text,
  box_weight_kg   numeric(10,3),
  created_at      timestamptz not null default now()
);
create index if not exists china_order_items_order_idx on china_order_items(order_id);
create index if not exists china_order_items_sku_idx on china_order_items(sku_id);

create table if not exists cargo_shipments (
  id                  bigserial primary key,
  arrival_date        date not null,
  total_cargo_rub     numeric(14,2) not null default 0,
  customs_rub         numeric(14,2) not null default 0,
  packaging_rub       numeric(14,2) not null default 0,
  total_weight_kg     numeric(12,3),
  exchange_rate       numeric(10,4),
  allocation_method   text not null default 'weight',
  comment             text,
  created_at          timestamptz not null default now()
);

create table if not exists cargo_shipment_orders (
  shipment_id  bigint not null references cargo_shipments(id) on delete cascade,
  order_id     bigint not null references china_orders(id)    on delete cascade,
  primary key (shipment_id, order_id)
);

create table if not exists cogs_calculations (
  id                      bigserial primary key,
  sku_id                  bigint not null references sku_catalog(id) on delete cascade,
  shipment_id             bigint not null references cargo_shipments(id) on delete cascade,
  calculation_date        timestamptz not null default now(),
  qty                     integer not null,
  purchase_rub_per_unit   numeric(12,4) not null,
  cargo_rub_per_unit      numeric(12,4) not null default 0,
  customs_rub_per_unit    numeric(12,4) not null default 0,
  packaging_rub_per_unit  numeric(12,4) not null default 0,
  total_cost_rub_per_unit numeric(12,4) generated always as (
    purchase_rub_per_unit + cargo_rub_per_unit + customs_rub_per_unit + packaging_rub_per_unit
  ) stored,
  allocation_method       text not null,
  unique (sku_id, shipment_id)
);
create index if not exists cogs_calculations_sku_idx on cogs_calculations(sku_id);

create table if not exists cogs_history (
  id                bigserial primary key,
  sku_id            bigint not null references sku_catalog(id) on delete cascade,
  effective_from    timestamptz not null,
  effective_to      timestamptz,
  cost_price_rub    numeric(12,2) not null,
  source            text,
  shipment_id       bigint references cargo_shipments(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists cogs_history_sku_idx on cogs_history(sku_id, effective_from desc);

create or replace function cost_price_at(p_sku_id bigint, p_at timestamptz)
returns numeric language sql stable
set search_path = ''
as $$
  select cost_price_rub
  from public.cogs_history
  where sku_id = p_sku_id
    and effective_from <= p_at
    and (effective_to is null or effective_to > p_at)
  order by effective_from desc
  limit 1;
$$;

alter table china_orders          enable row level security;
alter table china_order_items     enable row level security;
alter table cargo_shipments       enable row level security;
alter table cargo_shipment_orders enable row level security;
alter table cogs_calculations     enable row level security;
alter table cogs_history          enable row level security;
