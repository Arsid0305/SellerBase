-- Недельная сводка по Ozon — просьба владелицы 18.09.2026 «давай ozon в неделю сводку».
--
-- До этого понедельничное письмо показывало только ВБ, а на Ozon уже 1 591 штука.
-- Раз в неделю приходило письмо, которое врало.
--
-- ВАЖНО про выручку. Ozon закрывает деньги раз в месяц (/v2/finance/realization),
-- недельного отчёта реализации у площадки нет. Поэтому недельная выручка тут
-- считается ПО ЗАКАЗАМ (ozon_postings + ozon_posting_items), а не по отчёту.
-- В тексте письма это сказано прямо, чтобы цифра не выдавалась за факт расчёта.
-- Расходы наоборот — настоящие недельные, они приходят в ozon_services
-- из /v1/finance/cash-flow-statement/list.

create or replace function public.get_weekly_ozon_report(p_week_start date default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  w_start date;
  w_end   date;
  p_start date;
  p_end   date;
  result  jsonb;
begin
  w_start := coalesce(p_week_start, (date_trunc('week', current_date) - interval '7 days')::date);
  w_end   := w_start + 6;
  p_start := w_start - 7;
  p_end   := w_start - 1;

  with zakazy as (
    select
      p.posting_number, p.status, p.scheme, p.created_at::date as d,
      i.offer_id, i.quantity, i.price
    from public.ozon_postings p
    join public.ozon_posting_items i on i.posting_number = p.posting_number
  ),
  nedelya as (
    select
      coalesce(sum(quantity) filter (where status <> 'cancelled'), 0) as units,
      coalesce(sum(quantity * price) filter (where status <> 'cancelled'), 0) as revenue,
      count(distinct offer_id) filter (where status <> 'cancelled') as skus,
      coalesce(sum(quantity) filter (where status = 'cancelled'), 0) as cancels,
      count(distinct posting_number) filter (where status <> 'cancelled') as otpravleniy,
      coalesce(sum(quantity) filter (where scheme = 'fbs' and status <> 'cancelled'), 0) as fbs_units
    from zakazy where d between w_start and w_end
  ),
  proshlaya as (
    select
      coalesce(sum(quantity) filter (where status <> 'cancelled'), 0) as units,
      coalesce(sum(quantity * price) filter (where status <> 'cancelled'), 0) as revenue
    from zakazy where d between p_start and p_end
  ),
  -- Расходы за неделю: они у Ozon настоящие недельные, в отличие от выручки
  rashody as (
    select
      public.ozon_service_group(s.name) as statya,
      round(-sum(s.price), 2) as summa
    from public.ozon_services s
    where s.period_begin between w_start and w_end
    group by 1
  ),
  ostatok as (
    select
      coalesce(sum(present) filter (where stock_type = 'fbo'), 0) as fbo,
      coalesce(sum(present) filter (where stock_type = 'fbs'), 0) as fbs
    from public.ozon_stocks
  ),
  top_tovary as (
    select z.offer_id as article,
           coalesce(c.title, z.offer_id) as title,
           sum(z.quantity) as units,
           round(sum(z.quantity * z.price)) as revenue
    from zakazy z
    left join public.sku_catalog c on c.my_article = z.offer_id
    where z.d between w_start and w_end and z.status <> 'cancelled'
    group by 1, 2
    order by 4 desc
    limit 5
  )
  select jsonb_build_object(
    'period', jsonb_build_object('week_start', w_start, 'week_end', w_end),
    'sales', jsonb_build_object(
      'units', n.units,
      'revenue', round(n.revenue),
      'skus_sold', n.skus,
      'cancels', n.cancels,
      'postings', n.otpravleniy,
      'fbs_units', n.fbs_units,
      'avg_check', case when n.otpravleniy > 0 then round(n.revenue / n.otpravleniy) end,
      'units_prev', pr.units,
      'revenue_prev', round(pr.revenue)
    ),
    'stock', jsonb_build_object('fbo', o.fbo, 'fbs', o.fbs, 'total', o.fbo + o.fbs),
    'expenses', coalesce((select jsonb_object_agg(statya, summa) from rashody), '{}'::jsonb),
    'expenses_total', coalesce((select round(sum(summa), 2) from rashody), 0),
    'top_revenue', coalesce((select jsonb_agg(to_jsonb(t)) from top_tovary t), '[]'::jsonb)
  )
  into result
  from nedelya n, proshlaya pr, ostatok o;

  return result;
end;
$function$;

-- Читает только сводка (service_role). Публичному ключу тут делать нечего.
revoke execute on function public.get_weekly_ozon_report(date) from public, anon;
