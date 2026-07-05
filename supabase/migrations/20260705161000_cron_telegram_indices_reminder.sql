-- Cron: telegram-indices-reminder — Пн 09:00 МСК (06:00 UTC).
-- Напоминает внести индексы локализации/распределения за прошлую неделю.

DO $$ BEGIN
  PERFORM cron.unschedule('telegram-indices-reminder-monday');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'telegram-indices-reminder-monday',
  '0 6 * * 1',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/telegram-indices-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), ''),
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );$cron$
);
