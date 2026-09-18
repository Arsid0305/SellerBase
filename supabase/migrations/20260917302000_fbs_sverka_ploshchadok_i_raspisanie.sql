-- Сверка заявленного по ФБС между площадками + расписание сбора.
--
-- Правило владелицы 17.09.2026: «остатки на складах ФБС ВБ = остатки на FBS
-- ozon = остатки ФБС на фулфилменте». Одна куча, заявленная обеим площадкам
-- одним и тем же числом.
--
-- Значит складывать нельзя, а сравнивать - нужно. Расхождение означает
-- потерянные продажи: если на ВБ заявлено сто, а на Ozon восемьдесят, то
-- двадцать штук на Ozon не продаются, хотя лежат на складе.
--
-- Разбивка Ozon по складам ФБС отдельным методом не нужна:
-- v4/product/info/stocks уже отдаёт по каждому товару запись с type=fbs,
-- количеством и списком складов, и она собирается в ozon_stocks. Старые
-- методы v1 площадка погасила, v2 дал бы то же самое - второй путь к тем
-- же числам не заводим (tasks/rules.md §26).

create or replace view public.v_fbs_stock_match as
with vb as (
  select s.barcode, sum(s.amount) as zayavleno
  from public.wb_fbs_stocks s
  where s.snapshot_date = (select max(snapshot_date) from public.wb_fbs_stocks)
  group by 1
),
oz as (
  select o.offer_id, sum(o.present) as zayavleno
  from public.ozon_stocks o
  where o.stock_type = 'fbs'
  group by 1
)
select
  c.my_article                       as artikul,
  c.title                            as tovar,
  coalesce(vb.zayavleno, 0)          as zayavleno_vb,
  coalesce(oz.zayavleno, 0)          as zayavleno_ozon,
  coalesce(vb.zayavleno, 0) - coalesce(oz.zayavleno, 0) as raznica,
  case
    when coalesce(vb.zayavleno, 0) = coalesce(oz.zayavleno, 0) then 'Сходится'
    when coalesce(oz.zayavleno, 0) < coalesce(vb.zayavleno, 0) then 'На Ozon заявлено меньше'
    else 'На ВБ заявлено меньше'
  end                                as sostoyanie,
  c.cost_price_rub
from public.sku_catalog c
left join vb on vb.barcode = c.barcode
left join oz on oz.offer_id = c.my_article
where c.is_active
  and (coalesce(vb.zayavleno, 0) > 0 or coalesce(oz.zayavleno, 0) > 0)
order by abs(coalesce(vb.zayavleno, 0) - coalesce(oz.zayavleno, 0)) desc, c.my_article;

comment on view public.v_fbs_stock_match is
  'ФБС: что заявлено ВБ и что Ozon по одному и тому же товару. Расхождение - потерянные продажи.';

-- Продажи по моделям: ФБО и ФБС отдельно, по каждой площадке.
-- ВБ - по типу склада из отчёта, Ozon - по схеме отправления.
create or replace view public.v_sales_by_model as
select
  'ВБ'::text as ploshchadka,
  case when s.warehouse_type = 'Склад WB' then 'ФБО' else 'ФБС' end as model,
  date_trunc('month', s.sale_dt)::date as mesyac,
  count(*) as prodazh,
  round(sum(coalesce(s.for_pay, 0)), 2) as k_perechisleniyu
from public.wb_sales_fact s
where not coalesce(s.is_storno, false)
group by 1, 2, 3
union all
select
  'Ozon'::text,
  case when p.scheme = 'fbo' then 'ФБО' else 'ФБС' end,
  date_trunc('month', p.created_at)::date,
  count(*),
  null::numeric
from public.ozon_postings p
group by 1, 2, 3;

comment on view public.v_sales_by_model is
  'Продажи по моделям работы. ВБ - по типу склада, Ozon - по схеме отправления.';

-- Сбор остатков ФБС с ВБ: дважды в день, вместе с остальными остатками.
select cron.schedule(
  'fetch-wb-fbs-stocks-twice-daily',
  '25 4,16 * * *',
  $$select net.http_post(
      url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-fbs-stocks',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 180000);$$
);
