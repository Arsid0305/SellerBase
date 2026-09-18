-- Уборка дубля и месячный итог Ozon.
--
-- Расходы Ozon уже собираются в ozon_cashflow / ozon_services
-- (миграции 20260917220000 и 20260917230000, функция fetch-ozon-expenses).
-- Позже в той же сессии контур был по ошибке заведён второй раз под другими
-- именами - ozon_cash_flow / ozon_service_costs и v_ozon_costs_by_month.
-- Два источника одной правды - худшее, что можно сделать с деньгами, поэтому
-- дубль убираем целиком. Правило: tasks/rules.md §26, одна точка входа.
--
-- Заодно закрываем то, чего действительно не хватало: месячный итог по Ozon
-- одной строкой. Раньше прибыль по площадке считалась без её расходов и была
-- завышена в разы (февраль: 125 260 против 30 471 в файле владелицы).

drop view if exists public.v_ozon_pnl_by_month;
drop view if exists public.v_ozon_costs_by_month;
drop table if exists public.ozon_service_costs;
drop table if exists public.ozon_cash_flow;

-- Месяц по Ozon: продажа, ставка площадки, расходы, что осталось до
-- себестоимости. Себестоимость и налог - слоем выше, там же где по ВБ.
create view public.v_ozon_pnl_by_month as
with realizaciya as (
  select
    make_date(year, month, 1) as mesyac,
    -- Цена в карточке: то, что заплатил покупатель. Баллы Ozon, звёзды и
    -- софинансирование банка - часть этой цены, без них выручка занижена.
    sum(sale_amount + coalesce(sale_bonus, 0) + coalesce(sale_stars, 0)
        + coalesce(sale_bank_coinvest, 0)) as prodano_po_karte,
    sum(coalesce(sale_standard_fee, 0)) as stavka_ozon,
    sum(coalesce(sale_total, 0)) as k_perechisleniyu,
    sum(coalesce(ret_total, 0)) as vozvrascheno,
    sum(coalesce(sale_qty, 0)) as prodano_sht,
    sum(coalesce(ret_qty, 0)) as vozvrat_sht
  from public.ozon_realization
  group by 1
),
rashody as (
  -- В v_ozon_expenses_by_month расход хранится минусом, как отдаёт Ozon.
  -- Здесь держим положительным: «сколько потратили».
  select mesyac, round(-sum(summa), 2) as rashody
  from public.v_ozon_expenses_by_month
  group by 1
)
select
  coalesce(r.mesyac, x.mesyac) as mesyac,
  round(r.prodano_po_karte, 2) as prodano_po_karte,
  round(r.stavka_ozon, 2) as stavka_ozon,
  round(r.k_perechisleniyu, 2) as k_perechisleniyu,
  round(r.vozvrascheno, 2) as vozvrascheno,
  r.prodano_sht,
  r.vozvrat_sht,
  coalesce(x.rashody, 0) as rashody,
  round(coalesce(r.k_perechisleniyu, 0) - coalesce(r.vozvrascheno, 0)
        - coalesce(x.rashody, 0), 2) as do_sebestoimosti
from realizaciya r
full join rashody x on x.mesyac = r.mesyac;

comment on view public.v_ozon_pnl_by_month is
  'Ozon по месяцам: продажа, ставка площадки, расходы, остаток до себестоимости.';
