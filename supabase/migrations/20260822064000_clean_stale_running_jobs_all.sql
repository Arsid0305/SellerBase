-- Уборщик зависших задач: закрывает записи, застрявшие в статусе 'running'.
--
-- Почему не через try_job_lock, который уже лежит в базе с 20.06.
-- Он берёт pg_advisory_lock, а advisory-блокировка в Postgres живёт только внутри
-- сессии. Edge Function ходит через PostgREST: сессия закрывается сразу после
-- вызова, блокировка снимается сама. Подключение его к 24 функциям ничего бы
-- не дало — и это, вероятно, причина, по которой его так и не подключили.
--
-- Плюс существующая clean_stale_running_jobs требует имя задачи: чистит одну,
-- вызвать её должна была сама функция при старте. Ни одна не вызывает.
-- Отсюда 1481 зависшая запись у fetch-wb-ads, копившаяся с 20.06.
--
-- Здесь — проход по всем задачам сразу, вызывается по расписанию и потому
-- не зависит от того, помнит ли о нём конкретная функция.
create or replace function public.clean_stale_running_jobs_all(
  p_max_age interval default '2 hours'
) returns integer
language sql
set search_path to 'pg_catalog', 'public'
as $$
  with updated as (
    update public.ingestion_log
    set status = 'error',
        finished_at = now(),
        error_text = coalesce(error_text,
          'Зависла в статусе running: закрыта уборщиком clean_stale_running_jobs_all')
    where status = 'running'
      and started_at < now() - p_max_age
    returning 1
  )
  select count(*)::integer from updated;
$$;

comment on function public.clean_stale_running_jobs_all(interval) is
  'Закрывает записи ingestion_log, застрявшие в статусе running дольше p_max_age (по умолчанию 2 часа). Проход по всем job_name сразу. Вызывается кроном clean-stale-jobs-hourly. Порог 2 часа выбран с запасом: самый долгий реальный прогон — перезабор воронки окнами, около 10 минут.';

-- Крон уборщика. Раз в час, в 17-ю минуту — чтобы не совпадать с основными
-- сборщиками, которые ходят по :00 и :30.
select cron.unschedule('clean-stale-jobs-hourly')
where exists (select 1 from cron.job where jobname = 'clean-stale-jobs-hourly');

select cron.schedule(
  'clean-stale-jobs-hourly',
  '17 * * * *',
  $$select public.clean_stale_running_jobs_all('2 hours'::interval);$$
);
