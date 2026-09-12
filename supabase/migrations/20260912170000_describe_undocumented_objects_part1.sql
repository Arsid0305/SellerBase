-- Долг схемы, часть 1: описать в файлах то, что живёт в рабочей базе, но не
-- создаётся ни одной миграцией.
--
-- Сверка схемы (12.09.2026) насчитала 174 объекта расхождения. Корней в них
-- всего 21: 13 таблиц, 5 представлений и 3 функции; остальное — их колонки,
-- индексы и ключи. Эта миграция закрывает ту часть, которая не требует
-- решения владелицы: всё, что востребовано кодом или чем-то живым.
--
-- Здесь НЕТ: пяти таблиц контура «расследований» (problems, investigations,
-- causes, hypotheses, knowledge), трёх таблиц уведомлений, wb_supplies_fact
-- и представления v_wb_supplies_summary над ним. Все они пустые или почти
-- пустые и ничем не востребованы — описывать их или удалить, решает
-- владелица. До решения они остаются в известном долге.
--
-- Для рабочей базы миграция холостая: все объекты уже есть, а формы записи
-- выбраны идемпотентные. Смысл — в том, чтобы базу можно было собрать из
-- файлов заново.

-- ── Таблицы ──────────────────────────────────────────────────────────────

-- Тарифы возврата WB. Единственная таблица в этом списке с настоящими
-- данными: 13 018 строк на 12.09.2026.
create table if not exists public.wb_tariffs_return (
  id              bigserial primary key,
  effective_date  date not null,
  warehouse_name  text not null,
  geo_name        text,
  return_base     numeric(10,2),
  return_liter    numeric(10,2),
  raw             jsonb,
  created_at      timestamptz not null default now(),
  constraint wb_tariffs_return_effective_date_warehouse_name_key
    unique (effective_date, warehouse_name)
);

create index if not exists wb_tariffs_return_date_idx
  on public.wb_tariffs_return (effective_date desc);

alter table public.wb_tariffs_return enable row level security;

-- Три ставки расходов до отгрузки на WB. Сейчас все три пустые — значит в
-- разборе себестоимости колонка «Итого с ФФ» равна обычной себестоимости.
-- Это не поломка: ставки просто не заведены. Удалить таблицы нельзя —
-- на них стоит v_extra_tariffs_current, а через неё v_sku_cost_breakdown.
create table if not exists public.supplies_transport (
  id             bigserial primary key,
  effective_from date not null default current_date,
  rub_per_kg     numeric(10,4) not null,
  comment        text,
  created_at     timestamptz not null default now()
);

create table if not exists public.fulfillment_costs (
  id             bigserial primary key,
  effective_from date not null default current_date,
  rub_per_unit   numeric(10,4) not null,
  comment        text,
  created_at     timestamptz not null default now()
);

create table if not exists public.delivery_to_wb (
  id             bigserial primary key,
  effective_from date not null default current_date,
  rub_per_kg     numeric(10,4) not null,
  comment        text,
  created_at     timestamptz not null default now()
);

create index if not exists ix_supplies_transport_eff
  on public.supplies_transport (effective_from desc);
create index if not exists ix_fulfillment_costs_eff
  on public.fulfillment_costs (effective_from desc);
create index if not exists ix_delivery_to_wb_eff
  on public.delivery_to_wb (effective_from desc);

alter table public.supplies_transport enable row level security;
alter table public.fulfillment_costs  enable row level security;
alter table public.delivery_to_wb     enable row level security;

-- ── Представления ────────────────────────────────────────────────────────

-- Действующие ставки на сегодня. Питает v_sku_cost_breakdown — страницу
-- себестоимости.
create or replace view public.v_extra_tariffs_current as
  select
    (select st.rub_per_kg from public.supplies_transport st
      where st.effective_from <= current_date
      order by st.effective_from desc limit 1) as supplies_transport_rub_per_kg,
    (select fc.rub_per_unit from public.fulfillment_costs fc
      where fc.effective_from <= current_date
      order by fc.effective_from desc limit 1) as fulfillment_rub_per_unit,
    (select dw.rub_per_kg from public.delivery_to_wb dw
      where dw.effective_from <= current_date
      order by dw.effective_from desc limit 1) as delivery_to_wb_rub_per_kg;

-- Фактическая логистика за 60 дней по складу и товару.
create or replace view public.v_logistics_actual_60d as
  with sold as (
    select warehouse_name, nm_id, sum(quantity) as sold_units
    from public.wb_reports_fact
    where rr_dt >= current_date - interval '60 days'
      and doc_type_name = 'Продажа'
    group by warehouse_name, nm_id
  ), log as (
    select warehouse_name, nm_id, sum(delivery_rub) as logistics_rub
    from public.wb_reports_fact
    where rr_dt >= current_date - interval '60 days'
      and delivery_rub > 0
    group by warehouse_name, nm_id
  )
  select
    coalesce(s.warehouse_name, l.warehouse_name) as warehouse_name,
    coalesce(s.nm_id, l.nm_id)                   as nm_id,
    coalesce(s.sold_units, 0)                    as sold_units,
    coalesce(l.logistics_rub, 0)                 as logistics_rub,
    case when coalesce(s.sold_units, 0) > 0
         then round(coalesce(l.logistics_rub, 0) / s.sold_units::numeric, 2)
         else null end                           as avg_logistics_per_unit
  from sold s
  full join log l on s.warehouse_name = l.warehouse_name and s.nm_id = l.nm_id;

create or replace view public.v_logistics_actual_60d_by_warehouse as
  select
    warehouse_name,
    sum(sold_units)              as sold_units,
    round(sum(logistics_rub), 2) as logistics_rub,
    case when sum(sold_units) > 0
         then round(sum(logistics_rub) / sum(sold_units), 2)
         else null end           as avg_logistics_per_unit
  from public.v_logistics_actual_60d
  group by warehouse_name;

-- Средние расходы WB на единицу за 60 дней: комиссия, логистика, хранение,
-- эквайринг.
create or replace view public.v_sku_avg_costs_60d as
  with sold as (
    select nm_id,
           sum(quantity) as sold_units,
           avg(commission_percent) filter (where commission_percent > 0) as avg_commission_pct
    from public.wb_reports_fact
    where rr_dt >= current_date - interval '60 days'
      and doc_type_name = 'Продажа'
    group by nm_id
  ), costs as (
    select nm_id,
           sum(delivery_rub)  as delivery_total,
           sum(storage_fee)   as storage_total,
           sum(acquiring_fee) as acquiring_total
    from public.wb_reports_fact
    where rr_dt >= current_date - interval '60 days'
    group by nm_id
  )
  select
    coalesce(s.nm_id, c.nm_id)                  as nm_id,
    coalesce(s.sold_units, 0)                   as sold_units_60d,
    round(coalesce(s.avg_commission_pct, 0), 2) as avg_commission_pct,
    case when s.sold_units > 0
         then round(c.delivery_total / s.sold_units::numeric, 2)
         else null end                          as avg_logistics_per_unit,
    case when s.sold_units > 0
         then round(c.storage_total / s.sold_units::numeric, 2)
         else null end                          as avg_storage_per_unit,
    case when s.sold_units > 0
         then round(c.acquiring_total / s.sold_units::numeric, 2)
         else null end                          as avg_acquiring_per_unit
  from sold s
  full join costs c on s.nm_id = c.nm_id;

-- ── Функции ──────────────────────────────────────────────────────────────
-- Все три вызываются из кода сайта.

create or replace function public.get_constants_timeline()
returns table(dt date, cny_rate numeric, delivery_per_kg numeric, avg_cost_rub numeric)
language sql stable set search_path to ''
as $function$
  WITH dates AS (
    SELECT effective_from AS dt FROM public.cargo_tariffs
    UNION SELECT effective_from FROM public.delivery_to_wb
    UNION SELECT valid_from FROM public.sku_cost_history
  ),
  by_date AS (
    SELECT d.dt,
      (SELECT c.cny_rate_rub FROM public.cargo_tariffs c WHERE c.effective_from <= d.dt ORDER BY c.effective_from DESC LIMIT 1) AS cny_rate,
      (SELECT c.cny_delivery_per_kg FROM public.cargo_tariffs c WHERE c.effective_from <= d.dt ORDER BY c.effective_from DESC LIMIT 1) AS cny_deliv,
      (SELECT dw.rub_per_kg FROM public.delivery_to_wb dw WHERE dw.effective_from <= d.dt ORDER BY dw.effective_from DESC LIMIT 1) AS wb_deliv,
      (SELECT ROUND(AVG(cost_rub), 2) FROM public.sku_cost_history h
        WHERE h.valid_from <= d.dt AND (h.valid_to IS NULL OR h.valid_to > d.dt)) AS avg_cost
    FROM dates d
  )
  SELECT dt, cny_rate, COALESCE(wb_deliv, 0), avg_cost FROM by_date ORDER BY dt;
$function$;

create or replace function public.get_orders_cancel_stats(p_from date, p_to date)
returns table(total_orders bigint, cancelled bigint, cancel_rate_pct numeric)
language sql stable set search_path to ''
as $function$
  SELECT
    COUNT(*)::bigint AS total_orders,
    COUNT(*) FILTER (WHERE is_cancel = true)::bigint AS cancelled,
    CASE WHEN COUNT(*) > 0
      THEN ROUND(COUNT(*) FILTER (WHERE is_cancel = true)::numeric / COUNT(*)::numeric * 100, 1)
      ELSE 0
    END AS cancel_rate_pct
  FROM public.wb_orders_fact
  WHERE date::date BETWEEN p_from AND p_to;
$function$;

create or replace function public.get_supply_recommendation(
  p_lead_days integer default 60, p_safety_days integer default 14)
returns table(sku_id bigint, my_article text, wb_article bigint, barcode text,
              units_per_day numeric, total_stock bigint, days_left numeric,
              units_to_order integer)
language sql stable set search_path to ''
as $function$
  SELECT
    t.sku_id, t.my_article, t.wb_article, sc.barcode,
    COALESCE(t.units_per_day, 0) AS units_per_day,
    COALESCE(t.total_stock, 0) AS total_stock,
    CASE WHEN COALESCE(t.units_per_day, 0) > 0
      THEN ROUND(COALESCE(t.total_stock, 0)::numeric / t.units_per_day, 1)
      ELSE NULL END AS days_left,
    GREATEST(0::numeric,
      COALESCE(t.units_per_day, 0) * (p_lead_days + p_safety_days) - COALESCE(t.total_stock, 0)::numeric
    )::int AS units_to_order
  FROM public.v_turnover t
  LEFT JOIN public.sku_catalog sc ON sc.id = t.sku_id
  ORDER BY units_to_order DESC;
$function$;
