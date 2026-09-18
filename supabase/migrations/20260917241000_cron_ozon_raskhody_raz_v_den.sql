-- Расходы Ozon - раз в день.
--
-- Ozon закрывает неделю раз в неделю, но задним числом правит: компенсации и
-- перерасчёты приходят в уже закрытые периоды (июль: возврат 4 301 ₽ за
-- продвижение пришёл после закрытия месяца). Поэтому берём окно 120 дней
-- каждую ночь - перезаписываем тем, что Ozon думает сейчас.
--
-- 04:20 UTC - после товаров (03:50), до утренней сводки.

select cron.schedule(
  'fetch-ozon-expenses-daily',
  '20 4 * * *',
  $$
  select net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-ozon-expenses?days=120',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000);
  $$
);
