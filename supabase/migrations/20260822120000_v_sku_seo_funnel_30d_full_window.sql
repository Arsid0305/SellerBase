-- Возвращаем единое 30-дневное окно для всех метрик воронки.
--
-- Раньше корзина считалась за 7 дней: с 14.06 по 14.08.2026 она не собиралась
-- (функция читала у WB несуществующее поле addToCartCount вместо cartCount),
-- а API отказывался отдавать историю глубже недели.
-- 22.08.2026 пробел закрыт годовой выгрузкой из кабинета WB — данные достоверны
-- с 22.08.2025. Разные окна больше не нужны.
drop view if exists public.v_sku_seo_funnel_30d;

create view public.v_sku_seo_funnel_30d
with (security_invoker = true) as
select
  c.my_article,
  c.wb_article,
  coalesce(sum(f.open_count), 0)::bigint             as views_30d,
  coalesce(sum(f.order_count), 0)::bigint            as orders_30d,
  coalesce(sum(f.buyout_count), 0)::bigint           as buyouts_30d,
  coalesce(sum(f.order_sum), 0)::numeric             as order_sum_30d,
  coalesce(sum(f.add_to_cart_count), 0)::bigint      as cart_30d,
  coalesce(sum(f.add_to_wishlist_count), 0)::bigint  as wishlist_30d,
  case when coalesce(sum(f.open_count), 0) > 0
       then round(100.0 * sum(f.add_to_cart_count) / sum(f.open_count), 1)
       end as cr_cart_pct,
  case when coalesce(sum(f.open_count), 0) > 0
       then round(100.0 * sum(f.order_count) / sum(f.open_count), 1)
       end as cr_order_pct,
  case when coalesce(sum(f.order_count), 0) > 0
       then round(100.0 * sum(f.buyout_count) / sum(f.order_count), 1)
       end as buyout_pct
from public.sku_catalog c
left join public.wb_sales_funnel f
  on f.nm_id = c.wb_article
 and f.dt >= current_date - 30
where c.my_article is not null
group by c.my_article, c.wb_article;

comment on view public.v_sku_seo_funnel_30d is
  'Воронка за 30 дней в разрезе карточки для вкладки /seo: просмотры, корзина, отложенные, заказы, выкупы и конверсии. Источник — wb_sales_funnel, достоверна с 22.08.2025 (годовая выгрузка из кабинета WB).';
