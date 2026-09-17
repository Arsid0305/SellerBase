-- Cron: недельная сводка в телеграм. Понедельник 07:00 UTC = 10:00 МСК.
-- К этому времени ВБ уже закрыл прошлую неделю в отчёте реализации.

DO $$ BEGIN
  PERFORM cron.unschedule('telegram-weekly-report-monday');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'telegram-weekly-report-monday',
  '0 7 * * 1',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/telegram-weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), ''),
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);
