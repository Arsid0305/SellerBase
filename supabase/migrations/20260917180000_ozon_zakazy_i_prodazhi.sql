-- Ozon, шаг второй: заказы и продажи.
-- План контура - docs/integrations/OZON_PODKLYUCHENIE.md.
--
-- У Ozon единица учёта - отправление (posting), а не заказ: один заказ
-- покупателя может уехать несколькими отправлениями. Поэтому храним
-- отправления и их состав, как отдаёт площадка, не выдумывая свою модель.
--
-- Схемы ФБО и ФБС Ozon отдаёт разными методами, но состав одинаковый -
-- держим в одной таблице с пометкой схемы.
--
-- raw оставляем намеренно: документация Ozon из рабочей среды недоступна,
-- и полный ответ - единственный способ потом достроить недостающее, не
-- перезапрашивая площадку.

create table if not exists public.ozon_postings (
  posting_number  text primary key,
  order_id        bigint,
  order_number    text,
  scheme          text not null check (scheme in ('fbo', 'fbs')),
  status          text,
  created_at      timestamptz,
  shipment_date   timestamptz,
  delivering_date timestamptz,
  cancel_reason   text,
  warehouse_name  text,
  raw             jsonb,
  fetched_at      timestamptz not null default now()
);

create index if not exists ozon_postings_created_idx on public.ozon_postings (created_at);
create index if not exists ozon_postings_status_idx on public.ozon_postings (status);

comment on table public.ozon_postings is
  'Отправления Ozon: ФБО и ФБС вместе, схема в поле scheme. Единица учёта Ozon - отправление, а не заказ.';

create table if not exists public.ozon_posting_items (
  posting_number text not null references public.ozon_postings (posting_number) on delete cascade,
  offer_id       text not null,
  sku            bigint,
  quantity       integer not null default 0,
  price          numeric(12,2),
  fetched_at     timestamptz not null default now(),
  primary key (posting_number, offer_id)
);

create index if not exists ozon_posting_items_offer_idx on public.ozon_posting_items (offer_id);

comment on table public.ozon_posting_items is
  'Состав отправлений Ozon. offer_id - тот же артикул, что sku_catalog.my_article.';

alter table public.ozon_postings enable row level security;
alter table public.ozon_posting_items enable row level security;
