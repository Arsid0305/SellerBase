-- ФБС: остатки на складе продавца и признак модели в продажах.
--
-- Владелица начала торговать по ФБС на обеих площадках. Её правило
-- 17.09.2026, дословно: «остатки на складах ФБС ВБ = остатки на FBS ozon =
-- остатки ФБС на фулфилменте». То есть заявленное количество одно и то же,
-- и оно равно физическому остатку на фулфилменте.
--
-- Отсюда важное следствие: складывать заявленное по площадкам нельзя (это
-- одна куча), а РАСХОЖДЕНИЕ между площадками - само по себе сигнал. Если
-- ВБ знает сто штук, а Ozon восемьдесят, значит на Ozon двадцать штук
-- продаж теряется зря.
--
-- Источники проверены запросами 17.09.2026, см.
-- docs/integrations/FBS_PODKLYUCHENIE.md:
--   ВБ   - GET /api/v3/warehouses, POST /api/v3/stocks/{id}
--   Ozon - POST /v4/product/info/stocks (уже собирается, type=fbs)

-- Склады продавца ВБ. Сейчас один - «Москва (Чашниково)», он же фулфилмент.
create table if not exists public.wb_seller_warehouses (
  id            bigint primary key,
  name          text not null,
  office_id     bigint,
  store_id      bigint,
  cargo_type    smallint,
  delivery_type smallint,
  is_deleting   boolean not null default false,
  fetched_at    timestamptz not null default now()
);

comment on table public.wb_seller_warehouses is
  'Склады продавца на ВБ (модель «Маркетплейс»). Физически это фулфилмент.';

-- Остатки, заявленные ВБ по складу продавца. Снимок за день: нужна история,
-- чтобы видеть, когда заявленное разошлось с Ozon.
create table if not exists public.wb_fbs_stocks (
  snapshot_date date   not null default current_date,
  warehouse_id  bigint not null,
  barcode       text   not null,
  amount        integer not null,
  fetched_at    timestamptz not null default now(),
  primary key (snapshot_date, warehouse_id, barcode)
);

comment on table public.wb_fbs_stocks is
  'Что заявлено на ВБ как доступное по ФБС. Снимок за день.';

create index if not exists wb_fbs_stocks_barcode_idx on public.wb_fbs_stocks (barcode);

alter table public.wb_seller_warehouses enable row level security;
alter table public.wb_fbs_stocks enable row level security;

-- Признак модели в продажах ВБ. В отчёте /api/v1/supplier/sales есть поле
-- warehouseType: «Склад WB» - это ФБО, склад продавца - ФБС. Без него
-- продажи ВБ по моделям не разделить: имя склада для этого не годится.
--
-- ⚠️ Следующая миграция 20260917301000 делает эту колонку вычисляемой из
-- сырого ответа площадки. Читать надо её.
alter table public.wb_sales_fact
  add column if not exists warehouse_type text;

comment on column public.wb_sales_fact.warehouse_type is
  'Тип склада из отчёта ВБ. «Склад WB» - ФБО, склад продавца - ФБС.';

create index if not exists wb_sales_fact_warehouse_type_idx
  on public.wb_sales_fact (warehouse_type);
