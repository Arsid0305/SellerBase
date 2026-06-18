-- Cron: ежедневная проверка ключевых метрик (margin/buyout/deficit/cron-health/new-sku-no-cost)
-- и алерт владелице в Telegram если что-то сломалось. 08:00 UTC = 11:00 MSK.

SELECT cron.schedule(
  'telegram-alerts-daily',
  '0 8 * * *',
  $$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/telegram-alerts',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );$$
);
