-- Cron: дёргать fetch-wb-orders каждые 30 минут.
-- Функция сама ведёт курсор по max(last_change_date) - 1 час overlap (см. fetch-wb-sales).

SELECT cron.schedule(
  'fetch-wb-orders-30min',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-orders',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$$
);
