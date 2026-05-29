-- supabase-js не умеет onConflict по выражению
-- «(payload->>'srid')». Добавляем генерируемую колонку srid и unique index на неё.

alter table wb_reports_fact_raw
  add column if not exists srid text generated always as (payload->>'srid') stored;

drop index if exists wb_reports_fact_raw_bk_idx;
create unique index if not exists wb_reports_fact_raw_srid_idx
  on wb_reports_fact_raw(srid);
