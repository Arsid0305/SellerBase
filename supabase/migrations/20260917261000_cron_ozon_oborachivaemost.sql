-- Оборачиваемость Ozon - раз в день, 06:00 UTC.
--
-- Снимок за день, а не «текущее состояние»: смысл в том, чтобы видеть, как
-- товар сползает из зелёной оценки в критическую. Один снимок этого не
-- покажет, а по ряду снимков видно за неделю-две до того, как хранение
-- станет дорогим.
--
-- После всех остальных заданий по Ozon (товары 03:50, заказы 04:10,
-- деньги 05:20, расходы 05:40).

select cron.schedule(
  'fetch-ozon-turnover-daily',
  '0 6 * * *',
  $$select net.http_post(
      url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-ozon-turnover',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 180000);$$
);
