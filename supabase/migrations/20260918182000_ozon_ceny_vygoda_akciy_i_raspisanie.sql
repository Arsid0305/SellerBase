-- Стоит ли ронять цену ради продвижения, и расписание для цен и акций.
--
-- Акция «Эластичный бустинг» ставит вопрос ребром: опустить цену - товар
-- показывают выше, но с каждой продажи остаётся меньше. Сколько именно
-- меньше, в кабинете Ozon не написано: там видно цену и бустинг, но не
-- прибыль. А прибыль здесь и решает.
--
-- Считаем обе прибыли по одним тарифам: при нынешней акционной цене и при
-- цене, за которую дают максимальное продвижение.

create or replace view public.v_ozon_akcii_vygoda as
with tarify as (
  select
    p.product_id,
    p.offer_id,
    p.commission_pct_fbo / 100.0                  as komissiya_dolya,
    coalesce(p.fbo_logistika_min, 0)
      + coalesce(p.fbo_dostavka_pokupatelyu, 0)   as logistika_rub,
    p.price                                       as cena_bez_akcii
  from public.ozon_prices p
)
select
  a.title                                            as akciya,
  ap.offer_id,
  coalesce(c.title, ap.offer_id)                     as tovar,
  t.cena_bez_akcii,
  ap.akcionnaya_cena,
  ap.cena_dlya_max_busting,
  ap.busting_seychas,
  ap.busting_max,
  c.cost_price_rub                                   as sebestoimost,
  round(
    ap.akcionnaya_cena * (1 - t.komissiya_dolya)
    - t.logistika_rub
    - ap.akcionnaya_cena * 0.01
    - coalesce(c.cost_price_rub, 0), 2)              as pribyl_seychas,
  round(
    ap.cena_dlya_max_busting * (1 - t.komissiya_dolya)
    - t.logistika_rub
    - ap.cena_dlya_max_busting * 0.01
    - coalesce(c.cost_price_rub, 0), 2)              as pribyl_pri_max_bustinge,
  round(
    (ap.akcionnaya_cena - ap.cena_dlya_max_busting) * (1 - t.komissiya_dolya)
    + (ap.akcionnaya_cena - ap.cena_dlya_max_busting) * 0.01, 2) as poteryaem_na_shtuke
from public.ozon_action_products ap
join public.ozon_actions a on a.action_id = ap.action_id
join tarify t on t.product_id = ap.product_id
left join public.sku_catalog c on c.my_article = ap.offer_id
where ap.cena_dlya_max_busting is not null
  and ap.busting_max > ap.busting_seychas;

comment on view public.v_ozon_akcii_vygoda is
  'Цена против продвижения: сколько прибыли на штуке стоит максимальный бустинг в акции Ozon. Эквайринг взят 1 % от цены.';

alter view public.v_ozon_akcii_vygoda set (security_invoker = on);
revoke select on public.v_ozon_akcii_vygoda from anon;
revoke insert, update, delete, truncate on public.v_ozon_akcii_vygoda from anon, authenticated;

-- Расписание. Цены и акции - дважды в день, следом за товарами и заказами,
-- в свободные минуты: товары 03:50/15:50, заказы 04:10/16:10,
-- остатки ФБС ВБ 04:25/16:25.
select cron.schedule(
  'fetch-ozon-prices-twice-daily',
  '35 4,16 * * *',
  $$select net.http_post(
      url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-ozon-prices',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 180000);$$
);

select cron.schedule(
  'fetch-ozon-actions-twice-daily',
  '45 4,16 * * *',
  $$select net.http_post(
      url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-ozon-actions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 180000);$$
);
