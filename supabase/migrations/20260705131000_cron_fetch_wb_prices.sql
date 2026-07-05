-- Daily cron для fetch-wb-prices — тянет текущие цены WB по всем nm_id.
-- 05:00 МСК (02:00 UTC) — после fetch-wb-promotions (01:30 UTC), чтобы промо-матрица
-- уже знала список активных акций к моменту сравнения плановых/актуальных цен.

DO $$ BEGIN
  PERFORM cron.unschedule('fetch-wb-prices-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'fetch-wb-prices-daily',
  '0 2 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-prices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), ''),
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );$cron$
);
