-- Связь воронки с карточкой: сколько трафика у SKU и как он конвертируется.
-- Нужно чтобы чинить SEO там, где есть просмотры, а не там, где просто больше замечаний.
-- Только чтение, агрегат поверх wb_sales_funnel. Вычисления — как view (принцип проекта).
create or replace view public.v_sku_seo_funnel_30d
with (security_invoker = true) as
select
  c.my_article,
  c.wb_article,
  coalesce(sum(f.open_count), 0)::bigint        as views_30d,
  coalesce(sum(f.add_to_cart_count), 0)::bigint as cart_30d,
  coalesce(sum(f.order_count), 0)::bigint       as orders_30d,
  coalesce(sum(f.buyout_count), 0)::bigint      as buyouts_30d,
  coalesce(sum(f.order_sum), 0)::numeric        as order_sum_30d,
  -- Конверсия в корзину: главный сигнал качества карточки. Плохое описание
  -- и слабые характеристики видно именно здесь — просмотр есть, корзины нет.
  case when coalesce(sum(f.open_count), 0) > 0
       then round(100.0 * sum(f.add_to_cart_count) / sum(f.open_count), 1)
       end as cr_cart_pct,
  case when coalesce(sum(f.open_count), 0) > 0
       then round(100.0 * sum(f.order_count) / sum(f.open_count), 1)
       end as cr_order_pct
from public.sku_catalog c
left join public.wb_sales_funnel f
  on f.nm_id = c.wb_article
 and f.dt >= current_date - 30
where c.my_article is not null
group by c.my_article, c.wb_article;

comment on view public.v_sku_seo_funnel_30d is
  'Воронка за 30 дней в разрезе карточки: просмотры, корзина, заказы, выкупы и конверсии. Источник — wb_sales_funnel. Используется вкладкой /seo для приоритизации правок.';
