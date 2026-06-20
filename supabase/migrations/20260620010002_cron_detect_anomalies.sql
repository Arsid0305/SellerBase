-- Cron: детектор аномалий — раз в час сканирует SKU и пишет события в sku_events.

SELECT cron.schedule(
  'detect-anomalies-hourly',
  '0 * * * *',
  $$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/detect-anomalies',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$$
);
