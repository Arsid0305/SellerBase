-- Удаление старого ручного cron-дубля (заменён на fetch-wb-content-weekly).
-- Старый файл supabase/cron/fetch-wb-content.sql применялся через Dashboard вне миграций.

DO $$
BEGIN
  PERFORM cron.unschedule('fetch-wb-content-daily');
EXCEPTION WHEN OTHERS THEN
  -- cron не существует — пропускаем (idempotent).
  NULL;
END $$;
