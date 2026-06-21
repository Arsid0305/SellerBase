-- security(cron): переплан всех cron job-ов чтобы pg_cron слал заголовок X-Cron-Secret
-- в net.http_post. Edge functions сравнивают header с Deno.env CRON_SHARED_SECRET (см.
-- supabase/functions/_shared/auth.ts). Если ни secret в env, ни setting в БД не заданы —
-- header пустой, функция пропускает запрос (обратная совместимость).
--
-- Активация защиты после применения миграции (делает владелица):
--   1) supabase secrets set CRON_SHARED_SECRET=<long-random>
--   2) SELECT vault.create_secret('<тот же hex>', 'cron_shared_secret');  -- Supabase Vault (ALTER DATABASE недоступен)
--
-- НЕ трогаем: fetch-wb-sales-30min, fetch-wb-orders-30min, fetch-wb-ads-hourly
-- (правит параллельный агент в той же ветке).

-- ─────────────────────────────────────────────────────────────────────────────
-- telegram-alerts-daily
DO $$ BEGIN PERFORM cron.unschedule('telegram-alerts-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'telegram-alerts-daily',
  '0 8 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/telegram-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
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
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);

-- fetch-wb-content-weekly
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-content-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-content-weekly',
  '0 6 * * 2',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-content',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);

-- fetch-wb-funnel-daily (Dashboard cron — переносим в миграцию)
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-funnel-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-funnel-daily',
  '0 3 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-funnel',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
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
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);

-- fetch-wb-commissions-weekly
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-commissions-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-commissions-weekly',
  '0 5 * * 1',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-commissions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
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
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);

-- fetch-wb-tariffs-daily (Dashboard cron)
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-tariffs-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-tariffs-daily',
  '0 1 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-tariffs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );$cron$
);

-- fetch-wb-stocks-daily (Dashboard cron)
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-stocks-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-stocks-daily',
  '0 6 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-stocks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 1800000
  );$cron$
);

-- fetch-wb-report-weekly (Dashboard cron)
DO $$ BEGIN PERFORM cron.unschedule('fetch-wb-report-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'fetch-wb-report-weekly',
  '0 3 * * 2',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 600000
  );$cron$
);
