-- Проверка качества данных: сбои сборов считать по расписанию, а не по
-- последней записи в журнале. Аудит 11.09.2026.
--
-- Применено в прод 11.09.2026 через MCP apply_migration под именем
-- data_quality_ingestion_checks_by_schedule. Здесь тот же текст, чтобы
-- репозиторий умел собрать эту вьюху с нуля.
--
-- Было. Проверка ingestion_error показывала задачу, если её последний
-- запуск закончился ошибкой — когда бы он ни был. Из-за этого два снятых
-- с расписания сбора висели месяцами: fetch-wb-turnover с 11.06 (WB закрыл
-- адрес) и sync-sheets с 13.06. Они перестали быть проблемой, но глаз
-- к красному привыкал, и настоящая ошибка терялась.
--
-- И обратная дыра: если задача молча перестала запускаться совсем,
-- проверка молчала — последний-то запуск успешный.
--
-- Стало. Смотрим только на то, что стоит в расписании и включено:
--   ingestion_error   — последний запуск активной задачи с ошибкой;
--   ingestion_stalled — активная задача не запускалась больше восьми дней
--                       (недельные укладываются в семь).
-- Снятое с расписания не показывается вовсе: это уже не сбой, а решение.
--
-- Ограничение: задача, которая ни разу не написала в ingestion_log,
-- сюда не попадёт — отслеживаются только те, у кого есть журнал.

create or replace view public.v_data_quality as
with scheduled as (
  select distinct l.job_name
    from ingestion_log l
    join cron.job j on j.active and j.command like '%' || l.job_name || '%'
), last_run as (
  select distinct on (l.job_name)
         l.job_name, l.status, l.started_at, l.error_text
    from ingestion_log l
    join scheduled s on s.job_name = l.job_name
   order by l.job_name, l.started_at desc
)
 select 'sku_no_barcode'::text as check_name,
        s.my_article as ref,
        'SKU без штрихкода'::text as detail
   from sku_catalog s
  where s.is_active and (s.barcode is null or s.barcode = ''::text)
union all
 select 'sku_no_cost'::text,
        s.my_article,
        'Активный SKU без себестоимости'::text
   from sku_catalog s
  where s.is_active and (s.cost_price_rub is null or s.cost_price_rub = 0::numeric)
union all
 select 'negative_margin'::text,
        p.my_article,
        'Отрицательная маржа при выручке '::text || p.revenue_rub
   from v_pnl_by_sku p
  where p.revenue_rub > 0::numeric and p.net_profit_rub < 0::numeric
union all
 select 'low_margin'::text,
        p.my_article,
        ('Маржа '::text || round(p.margin_pct * 100::numeric, 1)) || '% ниже целевой'::text
   from v_pnl_by_sku p
  where p.revenue_rub > 0::numeric and p.margin_pct < app_setting_num('target_margin'::text)
union all
 select 'oos_soon'::text,
        t.my_article,
        ('Остаток на '::text || round(t.days_to_oos_total, 1)) || ' дней'::text
   from v_turnover t
  where t.days_to_oos_total is not null
    and t.days_to_oos_total < app_setting_num('safety_stock_days'::text)
union all
 select 'ingestion_error'::text,
        r.job_name,
        'Последний запуск с ошибкой: '::text || coalesce(r.error_text, ''::text)
   from last_run r
  where r.status = 'error'::text
union all
 select 'ingestion_stalled'::text,
        r.job_name,
        'Не запускалась с '::text || to_char(r.started_at, 'DD.MM.YYYY')
   from last_run r
  where r.started_at < now() - interval '8 days';

alter view public.v_data_quality set (security_invoker = on);
