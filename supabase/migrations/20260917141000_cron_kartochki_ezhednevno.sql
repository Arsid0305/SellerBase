-- Карточки синхронизируем каждый день, а не раз в неделю.
-- Дата заливки нужна точной: при недельном опросе «сработала ли новая
-- инфографика» пришлось бы считать от даты с погрешностью в семь дней.
-- Запрос к ВБ один на все карточки, нагрузки это не добавляет.

DO $$ BEGIN
  PERFORM cron.unschedule('fetch-wb-content-weekly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('fetch-wb-content-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'fetch-wb-content-daily',
  '35 6 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-content',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), ''),
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);
