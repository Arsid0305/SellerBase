-- Состояние каждой ingestion-задачи одной строкой.
--
-- Зачем. telegram-alerts читал последние 500 строк ingestion_log и по ним искал
-- последний успех. Но fetch-wb-sales и fetch-wb-orders идут каждые 30 минут:
-- 500 строк покрывают меньше двух суток. Недельная fetch-wb-commissions в окно
-- не попадала, и бот докладывал «нет успешных запусков» о задаче, которая
-- отработала успешно 5 дней назад. При этом соседняя проверка в том же
-- сообщении писала «комиссии обновлены 5 дней назад» — два условия
-- противоречили друг другу.
--
-- Здесь агрегат по всей таблице: усечения нет, дата последнего успеха точная.
-- Плюс last_status и last_error — чтобы стало видно задачи, которые раньше
-- работали, а теперь падают каждый день. Старая проверка их не замечала:
-- она искала только «никогда не было успеха».
create or replace view public.v_job_health
with (security_invoker = true) as
select
  job_name,
  max(started_at)                                   as last_run_at,
  max(finished_at) filter (where status = 'ok')     as last_success_at,
  (array_agg(status      order by started_at desc))[1] as last_status,
  (array_agg(error_text  order by started_at desc))[1] as last_error,
  count(*) filter (where status = 'error'
                     and started_at > now() - interval '24 hours') as errors_24h,
  count(*) filter (where status = 'error'
                     and started_at > now() - interval '7 days')   as errors_7d,
  count(*) filter (where status = 'running'
                     and started_at < now() - interval '2 hours')  as stuck_running
from public.ingestion_log
group by job_name;

comment on view public.v_job_health is
  'Состояние каждой ingestion-задачи одной строкой: последний запуск, последний успех, статус и текст последней ошибки, счётчики ошибок за сутки и неделю, число зависших записей. Источник для telegram-alerts и вкладки data-quality.';
