-- Две строки в недельную сводку: «Зависло» и «Потеряно».
-- Просьба владелицы 17.09.2026 после истории с 1 493 штуками, которые ВБ
-- держит в «в пути возвраты» с 16 августа и объясняет инвентаризацией.
--
-- Зависло - сколько штук и денег стоит в возвратах на склад ВБ и сколько
-- дней уже стоит. Настоящий возврат доезжает за дни; месяц на месте -
-- это не дорога, это остановленный товар.
--
-- Потеряно - убыль остатка, которую не объясняют ни продажи, ни товар,
-- уехавший к покупателям:
--   (склад на начало - склад на конец) - продано - прирост «в пути к покупателям»
-- Если владелица завозила товар, число уходит в минус - значит потерь нет,
-- есть приёмка. Такое показываем как ноль.
--
-- Имена складов нигде не зашиты: живой склад - это строка, которой нет в
-- справочнике служебных, а возвраты и товар в пути берутся по виду строки.

create or replace function public.get_weekly_losses(p_week_start date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  w_start date;
  w_end   date;
  result  jsonb;
begin
  w_start := coalesce(p_week_start, (date_trunc('week', current_date) - interval '7 days')::date);
  w_end   := w_start + 6;

  with live as (
    select h.snapshot_date, sum(h.quantity) q
    from wb_stocks_history h
    where not exists (select 1 from wb_stock_service_rows s where s.warehouse_name = h.warehouse_name)
      and h.snapshot_date in (w_start - 1, w_end)
    group by 1
  ),
  stuck as (
    select h.snapshot_date, sum(h.quantity) q,
           sum(h.quantity * coalesce(sc.cost_price_rub, 0)) rub,
           count(distinct h.nm_id) skus
    from wb_stocks_history h
    join wb_stock_service_rows s
      on s.warehouse_name = h.warehouse_name and s.kind = 'in_transit_from_client'
    left join sku_catalog sc on sc.wb_article = h.nm_id
    where h.snapshot_date = w_end
    group by 1
  ),
  to_client as (
    select h.snapshot_date, sum(h.quantity) q
    from wb_stocks_history h
    join wb_stock_service_rows s
      on s.warehouse_name = h.warehouse_name and s.kind = 'in_transit_to_client'
    where h.snapshot_date in (w_start - 1, w_end)
    group by 1
  ),
  sold as (
    select coalesce(sum(quantity), 0) q
    from wb_reports_fact
    where rr_dt between w_start and w_end and doc_type_name = 'Продажа'
  ),
  -- С какого дня возвраты стоят на месте. Берём начало текущего сидения, а не
  -- первый всплеск за всю историю: 19-21 июля возвраты уже подскакивали до
  -- 2 137 штук и через три дня рассосались - то был настоящий возврат.
  stuck_daily as (
    select h.snapshot_date d, sum(h.quantity) q
    from wb_stocks_history h
    join wb_stock_service_rows s
      on s.warehouse_name = h.warehouse_name and s.kind = 'in_transit_from_client'
    where h.snapshot_date <= w_end
    group by 1
  ),
  stuck_since as (
    select min(d) d from stuck_daily
    where q > 100
      and d > coalesce((select max(d) from stuck_daily where q <= 100), '1900-01-01'::date)
  ),
  calc as (
    select
      coalesce((select q from live where snapshot_date = w_start - 1), 0) sklad_start,
      coalesce((select q from live where snapshot_date = w_end), 0) sklad_end,
      coalesce((select q from to_client where snapshot_date = w_start - 1), 0) tc_start,
      coalesce((select q from to_client where snapshot_date = w_end), 0) tc_end,
      (select q from sold) prodano
  ),
  -- Средняя себестоимость живого остатка - ею оцениваем потерю в деньгах.
  avg_cost as (
    select case when sum(h.quantity) > 0
                then sum(h.quantity * coalesce(sc.cost_price_rub, 0)) / sum(h.quantity)
                else 0 end c
    from wb_stocks_history h
    left join sku_catalog sc on sc.wb_article = h.nm_id
    where h.snapshot_date = w_end
      and not exists (select 1 from wb_stock_service_rows s where s.warehouse_name = h.warehouse_name)
  )
  select jsonb_build_object(
    'stuck_units', coalesce((select q from stuck), 0),
    'stuck_rub', round(coalesce((select rub from stuck), 0)),
    'stuck_skus', coalesce((select skus from stuck), 0),
    'stuck_since', (select d from stuck_since),
    'stuck_days', case when (select d from stuck_since) is null then null
                       else w_end - (select d from stuck_since) end,
    'sklad_start', calc.sklad_start,
    'sklad_end', calc.sklad_end,
    'prodano', calc.prodano,
    'uehalo_k_pokupatelyam', calc.tc_end - calc.tc_start,
    -- Товар, уехавший к покупателям, из убыли вычитаем только когда его
    -- стало больше. Если «в пути» стало меньше, эти штуки либо уже посчитаны
    -- в проданном, либо вернулись на склад - потерей это не является.
    'lost_units', greatest(
      (calc.sklad_start - calc.sklad_end) - calc.prodano
        - greatest(calc.tc_end - calc.tc_start, 0), 0),
    'lost_rub', round(greatest(
      (calc.sklad_start - calc.sklad_end) - calc.prodano
        - greatest(calc.tc_end - calc.tc_start, 0), 0)
      * (select c from avg_cost))
  )
  into result
  from calc;

  return result;
end;
$$;

comment on function public.get_weekly_losses(date) is
  'Зависший в возвратах товар и необъяснённая убыль остатка за неделю. Читает telegram-weekly-report.';

revoke all on function public.get_weekly_losses(date) from public, anon, authenticated;
