-- Расписание для Ozon: заказы, деньги, расходы.
--
-- До этого по расписанию ходили только товары и остатки. Заказы, отчёт о
-- реализации и расходы забирались руками из сессии - то есть только пока
-- я рядом. Данные, которые обновляются вручную, рано или поздно устаревают
-- молча, а на них считается прибыль.
--
-- Времена в UTC, разнесены, чтобы не сталкиваться со сбором ВБ.
--
--   заказы   - дважды в день, как товары: продажи нужны свежими
--   деньги   - раз в сутки: месячный отчёт Ozon закрывает прошлый месяц
--              числа пятого, чаще смысла нет, но и пропустить нельзя
--   расходы  - раз в сутки: Ozon начисляет их понедельно
--
-- ⚠️ Окончательные времена и окна заданы следующей миграцией
-- 20260917251000: здесь расходы были поставлены на 05:40 окном 60 дней,
-- что перезаписало 04:20 из миграции 20260917241000. Читать расписание
-- нужно по последней миграции.

select cron.schedule(
  'fetch-ozon-postings-twice-daily',
  '10 4,16 * * *',
  $$select net.http_post(
      url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-ozon-postings?days=30',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 180000);$$
);

select cron.schedule(
  'fetch-ozon-finance-daily',
  '20 5 * * *',
  $$select net.http_post(
      url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-ozon-finance?months=3',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 180000);$$
);

select cron.schedule(
  'fetch-ozon-expenses-daily',
  '40 5 * * *',
  $$select net.http_post(
      url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-ozon-expenses?days=60',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 240000);$$
);
