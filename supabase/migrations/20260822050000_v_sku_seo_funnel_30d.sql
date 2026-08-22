-- Связь воронки с карточкой: сколько трафика у SKU и как он конвертируется.
-- Нужно чтобы чинить SEO там, где есть просмотры, а не там, где просто больше замечаний.
-- Только чтение, агрегат поверх wb_sales_funnel. Вычисления — как view (принцип проекта).
--
-- Корзина считается за 7 дней, просмотры и заказы — за 30. Почему разные окна:
-- с 14.06 по 14.08.2026 add_to_cart_count лежал нулём (функция читала у WB поле
-- addToCartCount, которого в ответе нет — реальное cartCount). Восстановить те даты
-- невозможно: WB отвечает `400 invalid start day: excess limit on days` на любую дату
-- начала глубже примерно недели. Конверсия в корзину за 30 дней была бы занижена в разы.
drop view if exists public.v_sku_seo_funnel_30d;

create view public.v_sku_seo_funnel_30d
with (security_invoker = true) as
select
  c.my_article,
  c.wb_article,
  coalesce(sum(f.open_count), 0)::bigint   as views_30d,
  coalesce(sum(f.order_count), 0)::bigint  as orders_30d,
  coalesce(sum(f.buyout_count), 0)::bigint as buyouts_30d,
  coalesce(sum(f.order_sum), 0)::numeric   as order_sum_30d,
  coalesce(sum(f.open_count) filter (where f.dt >= current_date - 7), 0)::bigint
    as views_7d,
  coalesce(sum(f.add_to_cart_count) filter (where f.dt >= current_date - 7), 0)::bigint
    as cart_7d,
  -- Конверсия в корзину — главный сигнал качества карточки: просмотр есть,
  -- корзины нет значит не убеждают наименование, фото и описание.
  case when coalesce(sum(f.open_count) filter (where f.dt >= current_date - 7), 0) > 0
       then round(100.0 * sum(f.add_to_cart_count) filter (where f.dt >= current_date - 7)
                        / sum(f.open_count) filter (where f.dt >= current_date - 7), 1)
       end as cr_cart_7d_pct,
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
  'Воронка в разрезе карточки для вкладки /seo. Просмотры, заказы, выкупы — за 30 дней. Корзина и конверсия в корзину — за 7 дней: с 14.06 по 14.08.2026 корзина не собиралась из-за ошибки имени поля WB, восстановить те даты WB не даёт.';
