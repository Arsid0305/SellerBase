-- Ежедневный запуск fetch-wb-tariffs в 01:00 UTC (04:00 МСК).
-- Применять через Supabase Dashboard (SQL Editor) после деплоя функции.
SELECT cron.schedule(
  'fetch-wb-tariffs-daily',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-tariffs',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
