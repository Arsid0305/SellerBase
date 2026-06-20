-- Cron: дёргать fetch-wb-ads каждый час.
-- Функция сама фетчит за последние N дней (?days=, default 7) — покрывает
-- задержку обновления статистики WB Advert API без сложного курсора.

SELECT cron.schedule(
  'fetch-wb-ads-hourly',
  '15 * * * *',  -- каждый час в 15-ю минуту (чтобы не пересекаться с другими cron)
  $$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-ads',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 240000
  );$$
);
