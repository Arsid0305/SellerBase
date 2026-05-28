-- Phase 1: initial schema
-- Принципы: idempotent UPSERT, сырые данные отдельно от нормализованных,
-- история для всего что меняется, key/value для настроек.

begin;

-- ============================================================
-- 1. sku_catalog — справочник товаров
-- ============================================================
create table if not exists sku_catalog (
  id              bigserial primary key,
  my_article      text not null unique,                  -- Арт.Мой
  wb_article      bigint unique,                          -- Арт.ВБ (nmId)
  barcode         text unique,                            -- ШК
  title           text,
  category        text,
  brand           text,
  unit_weight_kg  numeric(10,3),
  box_size        text,                                   -- '68*36*50'
  package_norm    integer,                                -- норма упаковки
  cost_price_rub  numeric(12,2),                          -- актуальная себестоимость (history — отдельно)
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists sku_catalog_wb_article_idx on sku_catalog(wb_article);
create index if not exists sku_catalog_barcode_idx on sku_catalog(barcode);

-- ============================================================
-- 2. wb_reports_fact_raw — сырьё отчёта о реализации (immutable)
-- ============================================================
create table if not exists wb_reports_fact_raw (
  id              bigserial primary key,
  fetched_at      timestamptz not null default now(),
  realizationreport_id bigint,
  payload         jsonb not null,                         -- одна строка отчёта WB как есть
  unique (realizationreport_id, (payload->>'srid'))       -- бизнес-ключ для UPSERT
);

create index if not exists wb_reports_fact_raw_report_idx on wb_reports_fact_raw(realizationreport_id);

-- ============================================================
-- 3. wb_reports_fact — нормализованные транзакции
-- ============================================================
create table if not exists wb_reports_fact (
  id                      bigserial primary key,
  srid                    text not null,                  -- WB unique transaction id
  realizationreport_id    bigint,
  nm_id                   bigint,
  barcode                 text,
  sa_name                 text,
  doc_type_name           text,                           -- 'Продажа' / 'Возврат' / ...
  order_dt                timestamptz,
  sale_dt                 timestamptz,
  rr_dt                   date,
  quantity                integer,
  retail_price            numeric(12,2),
  retail_amount           numeric(12,2),
  ppvz_for_pay            numeric(12,2),                  -- к перечислению
  delivery_rub            numeric(12,2),                  -- логистика по факту
  commission_rub          numeric(12,2),                  -- комиссия по факту
  penalty                 numeric(12,2),
  additional_payment      numeric(12,2),
  warehouse_name          text,
  created_at              timestamptz not null default now(),
  unique (srid)
);

create index if not exists wb_reports_fact_nm_idx on wb_reports_fact(nm_id);
create index if not exists wb_reports_fact_rr_dt_idx on wb_reports_fact(rr_dt);

-- ============================================================
-- 4. wb_stocks — текущий снапшот остатков
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
-- 5. wb_stocks_history — снапшоты остатков по дням
-- ============================================================
create table if not exists wb_stocks_history (
  id              bigserial primary key,
  snapshot_date   date not null,
  barcode         text not null,
  nm_id           bigint,
  warehouse_name  text not null,
  quantity        integer not null default 0,
  in_way_to_client    integer not null default 0,
  in_way_from_client  integer not null default 0,
  unique (snapshot_date, barcode, warehouse_name)
);

create index if not exists wb_stocks_history_date_idx on wb_stocks_history(snapshot_date);
create index if not exists wb_stocks_history_barcode_idx on wb_stocks_history(barcode);

-- ============================================================
-- 6. app_settings — key/value для внутренних коэффициентов
-- ============================================================
create table if not exists app_settings (
  key         text primary key,
  value       text not null,
  value_type  text not null default 'string',     -- 'string' | 'number' | 'boolean' | 'json'
  comment     text,
  updated_at  timestamptz not null default now()
);

-- Helper: достать число из app_settings
create or replace function app_setting_num(p_key text)
returns numeric
language sql stable
as $$
  select value::numeric from app_settings where key = p_key;
$$;

-- Helper: достать строку из app_settings
create or replace function app_setting_text(p_key text)
returns text
language sql stable
as $$
  select value from app_settings where key = p_key;
$$;

-- ============================================================
-- 7. ingestion_log — здоровье системы
-- ============================================================
create table if not exists ingestion_log (
  id           bigserial primary key,
  job_name     text not null,                      -- 'fetch-wb-stocks' и т.п.
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running',    -- 'running' | 'ok' | 'error'
  rows_in      integer,
  rows_out     integer,
  error_text   text,
  meta         jsonb
);

create index if not exists ingestion_log_job_idx on ingestion_log(job_name, started_at desc);
create index if not exists ingestion_log_status_idx on ingestion_log(status) where status = 'error';

commit;
