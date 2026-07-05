-- Daily cron для fetch-wb-feedback — тянет отзывы WB.
-- 05:30 МСК (02:30 UTC) — после fetch-wb-prices.

DO $$ BEGIN
  PERFORM cron.unschedule('fetch-wb-feedback-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'fetch-wb-feedback-daily',
  '30 2 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-feedback',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), ''),
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );$cron$
);
