-- pg_net — async HTTP из Postgres (вызываем Edge Functions из cron).
-- pg_cron — расписание.
create extension if not exists pg_net;
create extension if not exists pg_cron;
