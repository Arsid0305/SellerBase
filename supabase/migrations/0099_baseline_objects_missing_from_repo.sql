-- Объекты, которые есть в проде, но которых не создаёт ни одна миграция
-- репозитория. Найдено аудитом 11.09.2026.
--
-- Как получилось. Часть миграций применялась через MCP `apply_migration`,
-- минуя файлы репозитория. В проде они есть, в репозитории — нет, и база
-- перестала собираться с нуля: 27 миграций падали на отсутствующих
-- таблицах и колонке. Из-за этого не создавались вьюхи, которые проверяют
-- pgtap-тесты, тесты падали, и весь job стоял под continue-on-error.
--
-- Определения сняты с прода 11.09.2026 (information_schema + pg_constraint).
-- Всё через IF NOT EXISTS: в проде миграция ничего не меняет, в чистом
-- контейнере — достраивает недостающее.
--
-- Номер 0099 выбран намеренно: файл должен применяться после 0001, где
-- создаётся wb_reports_fact, и до миграций 20260611_*, которые строят
-- вьюхи поверх этих таблиц.
-- В прод применять не нужно: там эти объекты уже есть. Файл существует,
-- чтобы база собиралась с нуля — в CI и у любого, кто поднимет копию.


-- ── Воронка продаж по дням ─────────────────────────────────────────────
create table if not exists public.wb_sales_funnel (
  nm_id                     bigint  not null,
  dt                        date    not null,
  open_count                integer default 0,
  add_to_cart_count         integer default 0,
  order_count               integer default 0,
  order_sum                 numeric(14,2) default 0,
  buyout_count              integer default 0,
  buyout_sum                numeric(14,2) default 0,
  cancel_count              integer default 0,
  cancel_sum                numeric(14,2) default 0,
  fetched_at                timestamptz not null default now(),
  add_to_wishlist_count     integer not null default 0,
  add_to_cart_conversion    numeric not null default 0,
  cart_to_order_conversion  numeric not null default 0,
  buyout_percent            numeric not null default 0,
  primary key (nm_id, dt)
);

-- ── Воронка продаж за период ───────────────────────────────────────────
create table if not exists public.wb_sales_funnel_period (
  nm_id                  bigint not null primary key,
  period_start           date   not null,
  period_end             date   not null,
  open_count             integer default 0,
  cart_count             integer default 0,
  order_count            integer default 0,
  order_sum              numeric(14,2) default 0,
  buyout_count           integer default 0,
  buyout_sum             numeric(14,2) default 0,
  cancel_count           integer default 0,
  buyout_percent         integer,
  add_to_cart_percent    integer,
  cart_to_order_percent  integer,
  avg_price              numeric(12,2),
  avg_orders_per_day     numeric(8,2),
  share_order_percent    numeric(6,2),
  localization_percent   numeric(6,2),
  fetched_at             timestamptz not null default now()
);

-- ── Настройки ценообразования ──────────────────────────────────────────
create table if not exists public.pricing_settings (
  key         text    not null primary key,
  value       numeric not null,
  description text,
  updated_at  timestamptz not null default now()
);

-- ── Тарифы коробов WB ──────────────────────────────────────────────────
create table if not exists public.wb_tariffs_box (
  id                              bigserial primary key,
  effective_date                  date not null,
  warehouse_name                  text not null,
  geo_name                        text,
  box_delivery_base               numeric(10,2),
  box_delivery_liter              numeric(10,2),
  box_delivery_marketplace_base   numeric(10,2),
  box_delivery_marketplace_liter  numeric(10,2),
  box_storage_base                numeric(10,4),
  box_storage_liter               numeric(10,4),
  warehouse_coef                  numeric(6,3),
  raw                             jsonb,
  created_at                      timestamptz not null default now(),
  unique (effective_date, warehouse_name)
);

-- ── Комиссии по предметам ──────────────────────────────────────────────
create table if not exists public.wb_commissions_by_subject (
  subject_name           text not null primary key,
  parent_name            text,
  subject_id             bigint,
  kgvp_marketplace       numeric(6,2),
  kgvp_supplier          numeric(6,2),
  kgvp_supplier_express  numeric(6,2),
  paid_storage_kgvp      numeric(6,2),
  raw                    jsonb,
  fetched_at             timestamptz not null default now()
);

-- ── Колонки отчёта реализации ──────────────────────────────────────────
-- На них опираются расчёты P&L и маржи: десять миграций падали без них.
alter table public.wb_reports_fact
  add column if not exists storage_fee           numeric(12,2),
  add column if not exists acquiring_fee         numeric(12,2),
  add column if not exists acquiring_percent     numeric(6,3),
  add column if not exists deduction             numeric(12,2),
  add column if not exists bonus_type_name       text,
  add column if not exists ppvz_reward           numeric(12,2),
  add column if not exists ppvz_sales_commission numeric(12,2),
  add column if not exists ppvz_vw               numeric(12,2),
  add column if not exists ppvz_vw_nds           numeric(12,2),
  add column if not exists rebill_logistic_cost  numeric(12,2),
  add column if not exists supplier_oper_name    text;

-- ── Габариты в каталоге ────────────────────────────────────────────────
alter table public.sku_catalog
  add column if not exists length_cm numeric(6,2),
  add column if not exists width_cm  numeric(6,2),
  add column if not exists height_cm numeric(6,2),
  add column if not exists volume_l  numeric(8,3);
