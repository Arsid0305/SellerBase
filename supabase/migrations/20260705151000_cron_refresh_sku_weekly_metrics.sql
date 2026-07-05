-- Cron: пересборка sku_weekly_metrics для текущего года.
-- 04:00 МСК (01:00 UTC) — после fetch-wb-sales (23:30 UTC previous), до prom (01:30 UTC).

DO $$ BEGIN
  PERFORM cron.unschedule('refresh-sku-weekly-metrics-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'refresh-sku-weekly-metrics-daily',
  '0 1 * * *',
  $cron$SELECT public.refresh_sku_weekly_metrics(EXTRACT(year FROM CURRENT_DATE)::int);$cron$
);
