-- Cron: fetch-wb-supplies — FBW-поставки WB.
-- 06:00 МСК (03:00 UTC) — после fetch-wb-feedback (02:30 UTC).

DO $$ BEGIN
  PERFORM cron.unschedule('fetch-wb-supplies-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'fetch-wb-supplies-daily',
  '0 3 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-supplies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), ''),
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 600000
  );$cron$
);
