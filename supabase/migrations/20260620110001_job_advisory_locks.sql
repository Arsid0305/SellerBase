-- Advisory locks для cron-функций (защита от зомби-running записей и гонки).
-- Источник: аудит 2026-06-20, пункт 🔴 #3 «нет защиты от конкурентных запусков».

-- Попытаться взять lock для job_name. true = взяли, false = другой запуск держит.
CREATE OR REPLACE FUNCTION try_job_lock(p_job_name text)
RETURNS boolean
LANGUAGE sql
SET search_path = pg_catalog, public
AS $$
  SELECT pg_try_advisory_lock(hashtext(p_job_name));
$$;

COMMENT ON FUNCTION try_job_lock(text) IS
'Попытаться взять advisory_lock для cron-задачи. true = взяли, false = занят. Освобождать через release_job_lock в finally.';

-- Освободить lock после завершения работы.
CREATE OR REPLACE FUNCTION release_job_lock(p_job_name text)
RETURNS void
LANGUAGE sql
SET search_path = pg_catalog, public
AS $$
  SELECT pg_advisory_unlock(hashtext(p_job_name));
$$;

COMMENT ON FUNCTION release_job_lock(text) IS
'Освободить advisory_lock для cron-задачи. Вызывать в finally блока, чтобы lock всегда снимался.';

-- Закрыть зомби-running записи старше N (default 1 час).
-- Запускать в начале каждого runJob чтобы убрать накопленные зависшие записи.
CREATE OR REPLACE FUNCTION clean_stale_running_jobs(p_job_name text, p_max_age interval DEFAULT '1 hour'::interval)
RETURNS integer
LANGUAGE sql
SET search_path = pg_catalog, public
AS $$
  WITH updated AS (
    UPDATE public.ingestion_log
    SET status = 'error',
        finished_at = now(),
        error_text = 'Timeout: cleaned by next run (advisory_lock)'
    WHERE job_name = p_job_name
      AND status = 'running'
      AND started_at < now() - p_max_age
    RETURNING 1
  )
  SELECT COUNT(*)::integer FROM updated;
$$;

COMMENT ON FUNCTION clean_stale_running_jobs(text, interval) IS
'Закрыть зомби-записи в статусе running старше TTL. Возвращает количество закрытых.';
