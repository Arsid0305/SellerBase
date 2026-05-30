-- 0012_use_rrd_id_as_row_key.sql
-- Критичный фикс: WB возвращает несколько строк на один srid (продажа + логистика + хранение + штрафы).
-- Раньше дедупа по srid вырезала ~40% данных. Нужен уникальный ключ rrd_id.
--
-- Выявлено: при сверке января 2026 с Excel кабинета WB выяснилось, что
-- отчёт 601767029 имеет 2146 строк (1368 уникальных srid), и правильный ppvz_for_pay
-- = 149099 ₽. До фикса в БД было только 1365 строк и 54252 ₽ (в ~2.75 раз меньше).

-- 1. Очистка — данные неполны, перезальём через YC после редеплоя.
truncate table wb_reports_fact_raw, wb_reports_fact;

-- 2. wb_reports_fact_raw — переход на rrd_id
drop index if exists wb_reports_fact_raw_srid_uidx;
alter table wb_reports_fact_raw drop column if exists srid;

alter table wb_reports_fact_raw
  add column if not exists rrd_id bigint
  generated always as ((payload->>'rrd_id')::bigint) stored;

create unique index if not exists wb_reports_fact_raw_rrd_id_uidx
  on wb_reports_fact_raw (rrd_id);

-- 3. wb_reports_fact — добавить rrd_id, сделать его уникальным
alter table wb_reports_fact
  add column if not exists rrd_id bigint;

alter table wb_reports_fact
  drop constraint if exists wb_reports_fact_pkey;

alter table wb_reports_fact
  alter column rrd_id set not null;

alter table wb_reports_fact
  add constraint wb_reports_fact_rrd_id_uidx unique (rrd_id);

-- 4. srid — обычный индекс (не уникальный)
drop index if exists wb_reports_fact_srid_idx;
create index if not exists wb_reports_fact_srid_idx on wb_reports_fact (srid);

comment on column wb_reports_fact.rrd_id is
  'ID строки отчёта WB (rrd_id из payload). Уникален. Главный ключ.';
comment on column wb_reports_fact.srid is
  'ID заказа WB. Может повторяться (одна продажа → много операций).';
