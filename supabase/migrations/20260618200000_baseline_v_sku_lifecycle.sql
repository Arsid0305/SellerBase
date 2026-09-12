-- Представление жизненного цикла SKU: есть в проде, но ни одна миграция
-- репозитория его не создаёт. Найдено аудитом 11.09.2026.
--
-- Следующая миграция, 20260618220001_views_security_invoker.sql, переводит
-- его в security_invoker и падала на отсутствующем объекте.
--
-- Определение снято с прода (pg_get_viewdef) 11.09.2026.
-- В прод применять не нужно: там эти объекты уже есть. Файл существует,
-- чтобы база собиралась с нуля — в CI и у любого, кто поднимет копию.


create or replace view public.v_sku_lifecycle as
with facts as (
  select c.id as sku_id,
         c.wb_article,
         c.is_active,
         c.created_at,
         c.cost_price_rub,
         coalesce(sum(case when f.quantity > 0 and f.rr_dt >= current_date - interval '14 days'
                           then f.retail_amount else 0 end), 0) as revenue_14d,
         coalesce(sum(case when f.quantity > 0 and f.rr_dt < current_date - interval '14 days'
                            and f.rr_dt >= current_date - interval '28 days'
                           then f.retail_amount else 0 end), 0) as revenue_14d_prev,
         coalesce(sum(case when f.quantity > 0 and f.rr_dt >= current_date - interval '30 days'
                           then f.quantity else 0 end), 0)::numeric / 30.0 as units_per_day,
         coalesce(sum(case when f.quantity > 0 and f.rr_dt >= current_date - interval '30 days'
                           then f.retail_amount else 0 end), 0) as revenue_30d,
         coalesce(sum(case when f.quantity > 0 and f.rr_dt >= current_date - interval '30 days'
                           then f.ppvz_for_pay else 0 end), 0) as payout_30d,
         coalesce(sum(case when f.quantity > 0 and f.rr_dt >= current_date - interval '30 days'
                           then f.quantity else 0 end), 0) as units_30d,
         max(case when f.quantity > 0 then f.rr_dt end) as last_sale_date
    from sku_catalog c
    left join wb_reports_fact f on f.nm_id = c.wb_article
   group by c.id, c.wb_article, c.is_active, c.created_at, c.cost_price_rub
), stock_agg as (
  select nm_id, coalesce(sum(quantity), 0) as stock
    from wb_stocks group by nm_id
), ranked as (
  select f.sku_id,
         f.is_active,
         f.created_at,
         f.revenue_14d,
         f.revenue_14d_prev,
         f.units_per_day,
         coalesce(current_date - f.last_sale_date, 999) as days_since_last_sale,
         greatest(0, current_date - f.created_at::date) as days_in_catalog,
         coalesce(s.stock, 0) as stock,
         percent_rank() over (order by (f.revenue_14d + f.revenue_14d_prev) desc) as revenue_rank,
         case when f.revenue_30d > 0
              then (f.payout_30d - f.units_30d::numeric * coalesce(f.cost_price_rub, 0)) / f.revenue_30d * 100
              else 0 end as margin_pct
    from facts f
    left join stock_agg s on s.nm_id = f.wb_article
)
select sku_id,
       stock,
       units_per_day,
       revenue_14d,
       revenue_14d_prev,
       days_since_last_sale,
       days_in_catalog,
       case
         when is_active = false then 'ARCHIVED'
         when stock <= 0 and units_per_day > 0 then 'CRITICAL'
         when stock > 0 and days_since_last_sale > 14 then 'CRITICAL'
         when days_in_catalog < 14 then 'NEW'
         when revenue_rank <= 0.20 and margin_pct >= 20 and revenue_14d > revenue_14d_prev * 0.8 then 'LEADER'
         when revenue_14d_prev > 0 and revenue_14d >= revenue_14d_prev * 1.2 then 'GROWING'
         when revenue_14d_prev > 0 and revenue_14d <= revenue_14d_prev * 0.8 then 'DECLINING'
         when revenue_14d_prev = 0 and revenue_14d > 0 then 'GROWING'
         else 'STABLE'
       end as lifecycle
  from ranked;
