-- Phase 1: initial schema
-- Принципы: idempotent UPSERT, сырые данные отдельно от нормализованных,
-- история для всего что меняется, key/value для настроек.

-- ============================================================
-- 1. sku_catalog
-- ============================================================
create table if not exists sku_catalog (
  id              bigserial primary key,
  my_article      text not null unique,
  wb_article      bigint unique,
  barcode         text unique,
  title           text,
  category        text,
  brand           text,
  unit_weight_kg  numeric(10,3),
  box_size        text,
  package_norm    integer,
  cost_price_rub  numeric(12,2),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists sku_catalog_wb_article_idx on sku_catalog(wb_article);
create index if not exists sku_catalog_barcode_idx on sku_catalog(barcode);

-- ============================================================
-- 2. wb_reports_fact_raw — сырьё (immutable)
-- ============================================================
create table if not exists wb_reports_fact_raw (
  id                    bigserial primary key,
  fetched_at            timestamptz not null default now(),
  realizationreport_id  bigint,
  payload               jsonb not null
);
-- Бизнес-ключ через выражение — отдельным unique index (в inline `unique(...)` Postgres не принимает выражения).
create unique index if not exists wb_reports_fact_raw_bk_idx
  on wb_reports_fact_raw(realizationreport_id, (payload->>'srid'));
create index if not exists wb_reports_fact_raw_report_idx on wb_reports_fact_raw(realizationreport_id);

-- ============================================================
-- 3. wb_reports_fact — нормализованные транзакции
-- ============================================================
create table if not exists wb_reports_fact (
  id                      bigserial primary key,
  srid                    text not null unique,
  realizationreport_id    bigint,
  nm_id                   bigint,
  barcode                 text,
  sa_name                 text,
  doc_type_name           text,
  order_dt                timestamptz,
  sale_dt                 timestamptz,
  rr_dt                   date,
  quantity                integer,
  retail_price            numeric(12,2),
  retail_amount           numeric(12,2),
  ppvz_for_pay            numeric(12,2),
  delivery_rub            numeric(12,2),
  commission_rub          numeric(12,2),
  penalty                 numeric(12,2),
  additional_payment      numeric(12,2),
  warehouse_name          text,
  created_at              timestamptz not null default now()
);
create index if not exists wb_reports_fact_nm_idx on wb_reports_fact(nm_id);
create index if not exists wb_reports_fact_rr_dt_idx on wb_reports_fact(rr_dt);

-- ============================================================
-- 4. wb_stocks — текущий снапшот
-- ============================================================
create table if not exists wb_stocks (
  id                  bigserial primary key,
  barcode             text not null,
  nm_id               bigint,
  warehouse_name      text not null,
  quantity            integer not null default 0,
  in_way_to_client    integer not null default 0,
  in_way_from_client  integer not null default 0,
  last_change_date    timestamptz,
  fetched_at          timestamptz not null default now(),
  unique (barcode, warehouse_name)
);
create index if not exists wb_stocks_barcode_idx on wb_stocks(barcode);

-- ============================================================
-- 5. wb_stocks_history — снапшоты по дням
-- ============================================================
create table if not exists wb_stocks_history (
  id                  bigserial primary key,
  snapshot_date       date not null,
  barcode             text not null,
  nm_id               bigint,
  warehouse_name      text not null,
  quantity            integer not null default 0,
  in_way_to_client    integer not null default 0,
  in_way_from_client  integer not null default 0,
  unique (snapshot_date, barcode, warehouse_name)
);
create index if not exists wb_stocks_history_date_idx on wb_stocks_history(snapshot_date);
create index if not exists wb_stocks_history_barcode_idx on wb_stocks_history(barcode);

-- ============================================================
-- 6. app_settings — key/value
-- ============================================================
create table if not exists app_settings (
  key         text primary key,
  value       text not null,
  value_type  text not null default 'string',
  comment     text,
  updated_at  timestamptz not null default now()
);

create or replace function app_setting_num(p_key text)
returns numeric language sql stable
set search_path = ''
as $$
  select value::numeric from public.app_settings where key = p_key;
$$;

create or replace function app_setting_text(p_key text)
returns text language sql stable
set search_path = ''
as $$
  select value from public.app_settings where key = p_key;
$$;

-- ============================================================
-- 7. ingestion_log
-- ============================================================
create table if not exists ingestion_log (
  id           bigserial primary key,
  job_name     text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running',
  rows_in      integer,
  rows_out     integer,
  error_text   text,
  meta         jsonb
);
create index if not exists ingestion_log_job_idx on ingestion_log(job_name, started_at desc);
create index if not exists ingestion_log_status_idx on ingestion_log(status) where status = 'error';
