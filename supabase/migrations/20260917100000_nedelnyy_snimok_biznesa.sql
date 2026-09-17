-- Недельный снимок бизнеса: одна функция, которая собирает всё, что есть.
-- Просьба владелицы 17.09.2026: «включи в сводку всевозможные метрики, чтоб
-- они собирались, а по ходу дела будем смотреть, что выкидывать».
--
-- Состав показателей и честная оценка «есть / частично / нет» - в
-- docs/WEEKLY_REVIEW.md. Здесь собирается всё, что доступно по ВБ.
-- Ozon не упоминается: интеграции нет, писать «0» каждую неделю смысла нет.
--
-- Возвращает jsonb. Формат каждого числа - не голое значение, а строка
-- «текущая неделя / прошлая / среднее за 4 недели», чтобы было с чем
-- сравнивать. Читает функция telegram-weekly-report.

create or replace function public.get_weekly_owner_report(p_week_start date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  w_start date;
  w_end   date;
  p_start date;
  p_end   date;
  a_start date;   -- начало окна «среднее за 4 недели» (4 недели до текущей)
  result  jsonb;
begin
  -- По умолчанию берём последнюю закрытую неделю: понедельник-воскресенье.
  w_start := coalesce(p_week_start, (date_trunc('week', current_date) - interval '7 days')::date);
  w_end   := w_start + 6;
  p_start := w_start - 7;
  p_end   := w_start - 1;
  a_start := w_start - 28;

  with
  -- ── Продажи и экономика: недельные метрики по товарам ──────────────
  wk as (
    select
      sum(units_sold) units, sum(units_returned) units_ret,
      sum(revenue_wb) revenue, sum(cost_sold_total) cost,
      sum(commission_rub) commission, sum(logistics_rub) logistics,
      sum(storage_rub) storage, sum(net_profit) profit,
      count(*) filter (where units_sold > 0) skus_sold
    from sku_weekly_metrics
    where make_date(year, 1, 1) is not null
      and to_date(year::text || to_char(week_num, 'FM00'), 'IYYYIW') = w_start
  ),
  pv as (
    select sum(units_sold) units, sum(revenue_wb) revenue, sum(net_profit) profit
    from sku_weekly_metrics
    where to_date(year::text || to_char(week_num, 'FM00'), 'IYYYIW') = p_start
  ),
  av as (
    select avg(t.revenue) revenue, avg(t.profit) profit, avg(t.units) units
    from (
      select to_date(year::text || to_char(week_num, 'FM00'), 'IYYYIW') ws,
             sum(revenue_wb) revenue, sum(net_profit) profit, sum(units_sold) units
      from sku_weekly_metrics
      group by 1
    ) t
    where t.ws >= a_start and t.ws < w_start
  ),
  -- ── Прочие удержания и возмещения из отчёта реализации ─────────────
  rep as (
    select
      round(sum(penalty), 2) penalty,
      round(sum(deduction), 2) deduction,
      round(sum(acquiring_fee), 2) acquiring,
      round(sum(storage_fee), 2) storage_fee,
      round(sum(ppvz_for_pay), 2) for_pay,
      round(sum(retail_price * quantity) filter (where supplier_oper_name = 'Продажа'), 2) nachisleno,
      round(sum(delivery_rub) filter (where supplier_oper_name ilike '%оставка%'), 2) delivery_back,
      round(sum(ppvz_for_pay) filter (where supplier_oper_name ilike '%озмещ%'), 2) vozmeshcheniya
    from wb_reports_fact
    where rr_dt between w_start and w_end
  ),
  -- ── Воронка ───────────────────────────────────────────────────────
  fn as (
    select
      sum(open_count) opens, sum(add_to_cart_count) carts, sum(order_count) orders,
      sum(buyout_count) buyouts, sum(cancel_count) cancels,
      round(avg(nullif(add_to_cart_conversion, 0)), 2) conv_cart,
      round(avg(nullif(cart_to_order_conversion, 0)), 2) conv_order,
      round(avg(nullif(buyout_percent, 0)), 2) conv_buyout
    from wb_sales_funnel where dt between w_start and w_end
  ),
  fn_prev as (
    select sum(open_count) opens, sum(order_count) orders
    from wb_sales_funnel where dt between p_start and p_end
  ),
  -- ── Возвраты ──────────────────────────────────────────────────────
  ret as (
    select count(*) n from wb_goods_returns_events where return_date between w_start and w_end
  ),
  -- ── Остатки ───────────────────────────────────────────────────────
  st as (
    select sum(stock_qty) units, count(*) filter (where stock_qty > 0) skus_with,
           count(*) filter (where stock_qty = 0) skus_zero,
           count(*) filter (where turnover_days is not null and turnover_days < 30) skus_low,
           count(*) filter (where recommendation = 'срочно сливать') skus_over
    from v_turnover_by_sku
  ),
  running_out as (
    select coalesce(jsonb_agg(x order by x->>'days'), '[]'::jsonb) j from (
      select jsonb_build_object(
        'article', sc.my_article, 'title', left(coalesce(sc.title,''), 60),
        'stock', t.stock_qty, 'days', t.turnover_days) x, t.turnover_days
      from v_turnover_by_sku t join sku_catalog sc on sc.wb_article = t.nm_id
      where t.turnover_days is not null and t.turnover_days < 30
      order by t.turnover_days limit 10
    ) q
  ),
  in_transit as (
    select coalesce(sum(to_client), 0) units from wb_stocks_in_transit
  ),
  -- ── Ассортимент ───────────────────────────────────────────────────
  wk_sku as (
    select m.*, sc.my_article, sc.title
    from sku_weekly_metrics m
    left join sku_catalog sc on sc.id = m.sku_id
    where to_date(m.year::text || to_char(m.week_num, 'FM00'), 'IYYYIW') = w_start
  ),
  top_revenue as (
    select coalesce(jsonb_agg(x), '[]'::jsonb) j from (
      select jsonb_build_object('article', my_article, 'title', left(coalesce(title,''), 60),
                               'units', units_sold, 'revenue', round(revenue_wb)) x
      from wk_sku where units_sold > 0 order by revenue_wb desc limit 5
    ) q
  ),
  top_profit as (
    select coalesce(jsonb_agg(x), '[]'::jsonb) j from (
      select jsonb_build_object('article', my_article, 'title', left(coalesce(title,''), 60),
                               'profit', round(net_profit),
                               'margin', round(100 * net_profit / nullif(revenue_wb, 0), 1)) x
      from wk_sku where units_sold > 0 order by net_profit desc limit 5
    ) q
  ),
  losers as (
    select coalesce(jsonb_agg(x), '[]'::jsonb) j from (
      select jsonb_build_object('article', my_article, 'title', left(coalesce(title,''), 60),
                               'profit', round(net_profit),
                               'margin', round(100 * net_profit / nullif(revenue_wb, 0), 1)) x
      from wk_sku where units_sold > 0 and net_profit < 0 order by net_profit limit 10
    ) q
  ),
  no_sales as (
    select count(*) n from sku_catalog sc
    where sc.is_active
      and not exists (select 1 from wk_sku w where w.sku_id = sc.id and w.units_sold > 0)
  ),
  -- ── Цена и акции ──────────────────────────────────────────────────
  price_moves as (
    select count(*) n from (
      select nm_id, min(price_rub) mn, max(price_rub) mx
      from wb_prices_fact where date between w_start and w_end
      group by nm_id having min(price_rub) <> max(price_rub)
    ) q
  ),
  promos as (
    select count(*) n,
           coalesce(sum(in_promo_total), 0) v_akcii,
           coalesce(round(avg(participation_pct), 0), 0) uchastie
    from wb_promotions
    where end_at >= w_start and start_at <= w_end + 30
  ),
  -- ── Карточки и отзывы ─────────────────────────────────────────────
  rev as (
    select count(*) n,
           round(avg(rating), 2) avg_rating,
           count(*) filter (where rating <= 3) negative
    from wb_reviews_fact where created_at between w_start and w_end + 1
  ),
  rev_all as (
    select round(avg(rating), 2) avg_rating, count(*) n from wb_reviews_fact
  )
  select jsonb_build_object(
    'period', jsonb_build_object(
      'week_start', w_start, 'week_end', w_end,
      'prev_start', p_start, 'prev_end', p_end),
    'sales', jsonb_build_object(
      'units', coalesce(wk.units, 0), 'units_prev', coalesce(pv.units, 0),
      'units_avg4', round(coalesce(av.units, 0), 1),
      'revenue', round(coalesce(wk.revenue, 0)),
      'revenue_prev', round(coalesce(pv.revenue, 0)),
      'revenue_avg4', round(coalesce(av.revenue, 0)),
      'avg_check', round(coalesce(wk.revenue, 0) / nullif(wk.units, 0)),
      'skus_sold', coalesce(wk.skus_sold, 0),
      'returns_units', coalesce(wk.units_ret, 0)),
    'economy', jsonb_build_object(
      'cost', round(coalesce(wk.cost, 0)),
      'gross_profit', round(coalesce(wk.revenue, 0) - coalesce(wk.cost, 0)),
      'profit', round(coalesce(wk.profit, 0)),
      'profit_prev', round(coalesce(pv.profit, 0)),
      'profit_avg4', round(coalesce(av.profit, 0)),
      'margin_pct', round(100 * coalesce(wk.profit, 0) / nullif(wk.revenue, 0), 1),
      'commission', round(coalesce(wk.commission, 0)),
      'logistics', round(coalesce(wk.logistics, 0)),
      'storage', round(coalesce(wk.storage, 0)),
      'penalty', coalesce(rep.penalty, 0),
      'deduction', coalesce(rep.deduction, 0),
      'acquiring', coalesce(rep.acquiring, 0),
      'compensations', coalesce(rep.vozmeshcheniya, 0)),
    'funnel', jsonb_build_object(
      'opens', coalesce(fn.opens, 0), 'opens_prev', coalesce(fn_prev.opens, 0),
      'carts', coalesce(fn.carts, 0), 'orders', coalesce(fn.orders, 0),
      'orders_prev', coalesce(fn_prev.orders, 0),
      'buyouts', coalesce(fn.buyouts, 0), 'cancels', coalesce(fn.cancels, 0),
      'conv_cart', fn.conv_cart, 'conv_order', fn.conv_order, 'conv_buyout', fn.conv_buyout,
      'returns', coalesce(ret.n, 0)),
    'stock', jsonb_build_object(
      'units', coalesce(st.units, 0), 'skus_with', coalesce(st.skus_with, 0),
      'skus_zero', coalesce(st.skus_zero, 0), 'skus_low', coalesce(st.skus_low, 0),
      'skus_over', coalesce(st.skus_over, 0),
      'in_transit', in_transit.units,
      'running_out', running_out.j),
    'assortment', jsonb_build_object(
      'top_revenue', top_revenue.j, 'top_profit', top_profit.j,
      'losers', losers.j, 'no_sales', no_sales.n),
    'price_promo', jsonb_build_object(
      'price_changes', price_moves.n,
      'promos_active', promos.n, 'skus_in_promo', promos.v_akcii,
      'participation_pct', promos.uchastie),
    'cards', jsonb_build_object(
      'reviews_week', coalesce(rev.n, 0), 'rating_week', rev.avg_rating,
      'negative_week', coalesce(rev.negative, 0),
      'rating_all', rev_all.avg_rating, 'reviews_all', rev_all.n),
    'finance', jsonb_build_object(
      'nachisleno', coalesce(rep.nachisleno, 0),
      'k_vyplate', coalesce(rep.for_pay, 0),
      'uderzhano', coalesce(rep.deduction, 0) + coalesce(rep.penalty, 0))
  )
  into result
  from wk, pv, av, rep, fn, fn_prev, ret, st, running_out, in_transit,
       top_revenue, top_profit, losers, no_sales, price_moves, promos, rev, rev_all;

  return result;
end;
$$;

comment on function public.get_weekly_owner_report(date) is
  'Недельный снимок бизнеса по ВБ: продажи, экономика, воронка, остатки, ассортимент, цены и акции, карточки, финансы. Каждое число - с прошлой неделей и средним за 4 недели.';

revoke all on function public.get_weekly_owner_report(date) from public, anon, authenticated;
