-- Расписание Ozon - окончательное, одним местом.
--
-- Миграция 20260917241000 завела расходы на 04:20 окном 120 дней, следующая
-- за ней - на 05:40 окном 60 дней. Второе перезаписало первое молча:
-- cron.schedule по имени задания обновляет, а не создаёт второе. Чтобы
-- расписание нельзя было прочитать двумя способами, здесь оно задаётся
-- целиком и это последнее слово.
--
-- Окно расходов 120 дней, а не 60: Ozon правит закрытые недели задним
-- числом (в июле пришёл возврат 4 301 ₽ за продвижение). Короткое окно
-- такую правку не увидит.

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
      url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-ozon-expenses?days=120',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 240000);$$
);
