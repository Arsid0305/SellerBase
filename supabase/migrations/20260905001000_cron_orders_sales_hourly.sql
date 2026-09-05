-- Заказы и продажи — раз в час вместо каждых 30 минут. Решение владелицы 05.09.2026.
--
-- Считано по данным за 30 дней: 117 заказов и 94 продажи, то есть 3,9 и 3,1 в день.
-- При 48 прогонах в сутки полезными были примерно 8 из 100 — остальные получали
-- от WB «ничего нового». Денег это не стоило (2 880 вызовов при лимите 500 000),
-- но забивало ingestion_log: 2 141 запись по заказам и 2 137 по продажам за 45 дней.
-- В таком мусоре и потерялись «зависания», которые оказались опечаткой в имени
-- колонки журнала.
--
-- Максимальная задержка данных становится час вместо получаса. При четырёх
-- заказах в день это незаметно, а журнал стало возможно читать глазами.
-- Минуты разнесены (:05 и :20), чтобы два запроса не били в WB одновременно.
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-orders-30min'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-sales-30min'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-orders-hourly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-sales-hourly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'fetch-wb-orders-hourly',
  '5 * * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), ''),
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );$cron$
);

SELECT cron.schedule(
  'fetch-wb-sales-hourly',
  '20 * * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-sales',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), ''),
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );$cron$
);
