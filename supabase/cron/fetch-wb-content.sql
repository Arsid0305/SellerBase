-- Ежедневный запуск fetch-wb-content в 00:00 UTC (03:00 МСК).
-- Применять через Supabase Dashboard (SQL Editor) после деплоя функции.
SELECT cron.schedule(
  'fetch-wb-content-daily',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-content',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
