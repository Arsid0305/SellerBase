-- Ежедневный запуск fetch-wb-tariffs в 01:00 UTC (04:00 МСК).
-- Функция задеплоена с verify_jwt=false, поэтому Authorization не требуется.
SELECT cron.schedule(
  'fetch-wb-tariffs-daily',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-tariffs',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
