-- Все задания разведены с шагом 5 минут. Решение владелицы 09.09.2026.
--
-- Зачем. Минута «:00» была перегружена: detect-anomalies ходит там ежечасно,
-- и с ним в 01:00, 02:00, 03:00 и 06:00 совпадали ещё по два задания, а в
-- 08:00 — сводка в телеграм. Каждое такое совпадение — пачка одновременных
-- запросов к одному пулу PostgREST. Именно так сводка каждый день теряла две
-- строки, а поиск аномалий падал с «Gateway Timeout».
--
-- Как считалось. Ежечасные задания занимают свою минуту в КАЖДОМ часу,
-- поэтому ежедневные не должны попадать на их минуты. Сетка:
--   :00 detect-anomalies   :05 fetch-wb-orders   :10 clean-stale-jobs
--   :15 fetch-wb-ads (выключен)                  :20 fetch-wb-sales
-- Ежедневные и еженедельные начинаются с :25 и дальше с шагом 5 внутри
-- своего часа. Между соседними заданиями всегда не меньше пяти минут.
--
-- Меняются только расписания; команды заданий и признак active не трогаем
-- (fetch-wb-ads остаётся выключенным).

-- Ежечасные: единственная правка — уборщик с :17 на :10, чтобы шаг был ровный.
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'clean-stale-jobs-hourly'),          schedule := '10 * * * *');

-- Час 1
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'fetch-wb-tariffs-daily'),           schedule := '25 1 * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'refresh-sku-weekly-metrics-daily'), schedule := '30 1 * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'fetch-wb-promotions-daily'),        schedule := '35 1 * * *');

-- Час 2
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'fetch-wb-goods-returns-daily'),     schedule := '25 2 * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'fetch-wb-prices-daily'),            schedule := '30 2 * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'fetch-wb-feedback-daily'),          schedule := '35 2 * * *');
-- fetch-wb-questions-daily уже стоит на :40 — шаг от отзывов ровно 5 минут, не трогаем.

-- Час 3
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'fetch-wb-funnel-daily'),            schedule := '25 3 * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'fetch-wb-supplies-daily'),          schedule := '30 3 * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'fetch-wb-report-weekly'),           schedule := '35 3 * * 2');

-- Час 4. Агрегат воронки идёт часом позже самой воронки — порядок сохранён.
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'fetch-wb-funnel-aggregate-daily'),  schedule := '25 4 * * *');

-- Час 5
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'fetch-wb-commissions-weekly'),      schedule := '25 5 * * 1');

-- Час 6
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'fetch-wb-stocks-daily'),            schedule := '25 6 * * *');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'telegram-indices-reminder-monday'), schedule := '30 6 * * 1');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'fetch-wb-content-weekly'),          schedule := '35 6 * * 2');

-- Час 8. Сводка владелице: 08:25 UTC = 11:25 МСК (было 11:00, затем 11:10).
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'telegram-alerts-daily'),            schedule := '25 8 * * *');
