-- Cron: ежедневный снимок каталога в sku_snapshots.
-- Расписание: 23:00 UTC = 02:00 МСК.
-- Требует расширения pg_cron + pg_net (включены в 0008_enable_pg_net_pg_cron.sql)
-- и установленного `app.settings.service_role_key` (Database → Settings).

SELECT cron.schedule(
  'snapshot-catalog-daily',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/snapshot-catalog',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
