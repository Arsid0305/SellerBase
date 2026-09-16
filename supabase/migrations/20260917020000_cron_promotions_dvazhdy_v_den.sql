-- Акции WB тянем дважды в день, а не раз.
-- Просьба владелицы 16.09.2026: «акции требуют ежедневного монитора -
-- подтягивания 2 раза в день». Утренний прогон уже есть (01:35 UTC =
-- 04:35 МСК), добавляем дневной в 13:35 UTC = 16:35 МСК.

DO $$ BEGIN
  PERFORM cron.unschedule('fetch-wb-promotions-midday');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'fetch-wb-promotions-midday',
  '35 13 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-promotions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), ''),
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);
