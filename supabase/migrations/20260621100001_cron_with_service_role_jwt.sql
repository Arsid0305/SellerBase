-- security(cron): второй слой защиты edge functions — verify_jwt=true в config.toml.
-- pg_cron теперь шлёт ДВА заголовка:
--   • Authorization: Bearer <service_role JWT>  — для проверки Supabase до запуска функции
--   • X-Cron-Secret: <hex>                       — для проверки в коде (см. _shared/auth.ts)
--
-- Оба секрета читаются из Supabase Vault (ALTER DATABASE postgres SET app.settings.*
-- в Supabase НЕДОСТУПЕН — нужен superuser).
--
-- ⚠️ ПОРЯДОК РАСКАТЫВАНИЯ (критично — иначе все cron падают с 401):
--   1) Владелица в Supabase Dashboard → SQL Editor выполняет:
--        SELECT vault.create_secret('<service_role JWT>', 'service_role_key');
--      JWT берётся в Dashboard → Settings → API → Project API keys → service_role.
--   2) Только ПОСЛЕ этого мержить PR — миграция применится через migrate.yml.
--
-- Если service_role JWT ротируется — обновить значение:
--   UPDATE vault.secrets SET secret = vault.encrypted_secret('<новый JWT>') WHERE name = 'service_role_key';
-- (проще: через Dashboard → Project Settings → Vault).
--
-- Обработаны ВСЕ 13 активных cron job-ов (telegram-alerts, detect-anomalies,
-- fetch-wb-{content,funnel,funnel-aggregate,commissions,goods-returns,tariffs,
-- stocks,report,sales,orders,ads}). Dashboard-cron'ы перенесены в миграцию.

-- ─────────────────────────────────────────────────────────────────────────────
-- telegram-alerts-daily (08:00 UTC = 11:00 МСК)
DO $$ BEGIN PERFORM cron.unschedule('telegram-alerts-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'telegram-alerts-daily',
  '0 8 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/telegram-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), ''),
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );$cron$
);

-- detect-anomalies-hourly
DO $$ BEGIN PERFORM cron.unschedule('detect-anomalies-hourly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'detect-anomalies-hourly',
  '0 * * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/detect-anomalies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), ''),
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);

-- fetch-wb-content-weekly (вт 06:00 UTC = 09:00 МСК)
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-content-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-content-weekly',
  '0 6 * * 2',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-content',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), ''),
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);

-- fetch-wb-funnel-daily (Dashboard cron → миграция)
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-funnel-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-funnel-daily',
  '0 3 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-funnel',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), ''),
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);

-- fetch-wb-funnel-aggregate-daily
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-funnel-aggregate-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-funnel-aggregate-daily',
  '0 4 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-funnel-aggregate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), ''),
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);

-- fetch-wb-commissions-weekly (пн 05:00 UTC = 08:00 МСК)
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-commissions-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-commissions-weekly',
  '0 5 * * 1',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-commissions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), ''),
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );$cron$
);

-- fetch-wb-goods-returns-daily
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-goods-returns-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-goods-returns-daily',
  '0 2 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-goods-returns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), ''),
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);

-- fetch-wb-tariffs-daily (Dashboard cron → миграция)
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-tariffs-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-tariffs-daily',
  '0 1 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-tariffs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), ''),
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);

-- fetch-wb-stocks-daily (Dashboard cron → миграция)
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-stocks-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-stocks-daily',
  '0 6 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-stocks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), ''),
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 1800000
  );$cron$
);

-- fetch-wb-report-weekly (вт 03:00 UTC = 06:00 МСК, Dashboard cron → миграция)
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-report-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-report-weekly',
  '0 3 * * 2',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), ''),
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 600000
  );$cron$
);

-- fetch-wb-sales-30min
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-sales-30min'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-sales-30min',
  '*/30 * * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-sales',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), ''),
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);

-- fetch-wb-orders-30min
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-orders-30min'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-orders-30min',
  '*/30 * * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), ''),
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);

-- fetch-wb-ads-hourly (каждый час в :15 чтобы не пересекаться)
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-ads-hourly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-ads-hourly',
  '15 * * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-ads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), ''),
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 240000
  );$cron$
);
