-- Cron: товары и остатки Ozon, дважды в день.
-- Утром в 06:50 МСК (03:50 UTC) - до того, как владелица откроет программу,
-- и вечером в 18:50 МСК (15:50 UTC), чтобы дневные отгрузки были видны.
--
-- Чаще не нужно: остатки Ozon меняются с продажами, а их пока единицы.

DO $$ BEGIN
  PERFORM cron.unschedule('fetch-ozon-products-twice-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'fetch-ozon-products-twice-daily',
  '50 3,15 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-ozon-products',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), ''),
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);
