-- Первый отпечаток карточек Ozon и расписание загрузки.
--
-- Снимок берётся сразу после первой загрузки: 61 карточка, у всех есть
-- описание. Метка 'first_after_owner_edits' - напоминание, что это состояние
-- уже после правок владелицы, а не «до».
--
-- Идемпотентно: повторный прогон за тот же день обновит, а не задвоит.
insert into public.ozon_content_snapshots
  (snapshot_date, product_id, offer_id, name, description, attributes, primary_image, images_count, reason)
select current_date, c.product_id, c.offer_id, c.name, c.description,
       c.attributes, c.primary_image, c.images_count, 'first_after_owner_edits'
from public.ozon_content c
on conflict (product_id, snapshot_date) do update set
  offer_id      = excluded.offer_id,
  name          = excluded.name,
  description   = excluded.description,
  attributes    = excluded.attributes,
  primary_image = excluded.primary_image,
  images_count  = excluded.images_count,
  reason        = excluded.reason,
  created_at    = now();

-- Раз в день: описания Ozon отдаёт по одному товару за запрос, загрузка идёт
-- с паузой и занимает минуту. Чаще незачем - тексты меняются руками и редко.
select cron.schedule(
  'fetch-ozon-content-daily',
  '55 4 * * *',
  $$select net.http_post(
      url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-ozon-content',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000);$$
);
