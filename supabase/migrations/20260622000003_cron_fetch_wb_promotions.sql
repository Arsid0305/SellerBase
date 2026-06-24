-- Daily cron для fetch-wb-promotions — тянет календарь акций WB + участвующих SKU.
-- Раньше функция запускалась только вручную → матрица /promo показывала старые данные
-- (от последнего ручного запуска, возможно недельной давности).
-- Cron — раз в день 04:30 МСК (01:30 UTC), после большинства WB-cron'ов чтобы не
-- упереться в rate limit. WB Promo API: 10 req/мин, между nomenclatures ≥2.5с — заложено в коде.

DO $$ BEGIN
  PERFORM cron.unschedule('fetch-wb-promotions-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'fetch-wb-promotions-daily',
  '30 1 * * *',
  $cron$SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-promotions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_shared_secret'), ''),
      'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );$cron$
);

COMMENT ON EXTENSION pg_cron IS 'fetch-wb-promotions-daily — 04:30 МСК, обновляет wb_promotions + wb_promotion_items для матрицы /promo';
