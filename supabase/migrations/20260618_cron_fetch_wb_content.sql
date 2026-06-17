-- Cron: синхронизация карточек товаров с WB Content API раз в неделю,
-- вторник 06:00 UTC = 09:00 МСК.

SELECT cron.schedule(
  'fetch-wb-content-weekly',
  '0 6 * * 2',
  $$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-content',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
  );$$
);
