-- Подготовка тестовой базы: то, что в проде даёт Supabase, а в чистом
-- контейнере отсутствует.
--
-- Зачем. До 11.09.2026 из 139 миграций в CI не применялись 46 — не хватало
-- ролей, расширений pg_net и pg_cron и хранилища секретов. Из-за этого
-- не создавались вьюхи и функции, которые pgtap-тесты и проверяют, тесты
-- падали, и весь job был помечен continue-on-error. Проверок базы
-- фактически не было.
--
-- Здесь не воспроизводится поведение Supabase — только объекты, на которые
-- ссылаются миграции, чтобы они дошли до конца. Заглушки ничего не делают:
-- сетевых вызовов и расписаний в тестах быть не должно.

-- ── Роли ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    create role supabase_admin nologin noinherit;
  end if;
end
$$;

create schema if not exists extensions;

-- ── pg_net: настоящее расширение, иначе заглушка ───────────────────────
do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  null;  -- в чистом контейнере расширения нет, ниже будет заглушка
end
$$;

create schema if not exists net;

create or replace function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb,
  timeout_milliseconds integer default 5000
) returns bigint language sql immutable as $$ select 0::bigint $$;

create or replace function net.http_get(
  url text,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb,
  timeout_milliseconds integer default 5000
) returns bigint language sql immutable as $$ select 0::bigint $$;

-- ── pg_cron: расписаний в тестах нет, только приёмник вызовов ──────────
create schema if not exists cron;

create table if not exists cron.job (
  jobid    bigserial primary key,
  schedule text,
  command  text,
  nodename text default 'localhost',
  nodeport integer default 5432,
  database text default current_database(),
  username text default current_user,
  active   boolean default true,
  jobname  text
);

create or replace function cron.schedule(job_name text, schedule text, command text)
returns bigint language plpgsql as $$
declare id bigint;
begin
  delete from cron.job where jobname = job_name;
  insert into cron.job (schedule, command, jobname) values (schedule, command, job_name)
  returning jobid into id;
  return id;
end
$$;

create or replace function cron.schedule(schedule text, command text)
returns bigint language sql as $$ select cron.schedule(command, schedule, command) $$;

create or replace function cron.unschedule(job_name text)
returns boolean language plpgsql as $$
begin
  delete from cron.job where jobname = job_name;
  return true;
end
$$;

create or replace function cron.unschedule(job_id bigint)
returns boolean language plpgsql as $$
begin
  delete from cron.job where jobid = job_id;
  return true;
end
$$;

create or replace function cron.alter_job(
  job_id bigint,
  schedule text default null,
  command text default null,
  database text default null,
  username text default null,
  active boolean default null
) returns void language plpgsql as $$
begin
  update cron.job j
     set schedule = coalesce(alter_job.schedule, j.schedule),
         command  = coalesce(alter_job.command, j.command),
         active   = coalesce(alter_job.active, j.active)
   where j.jobid = alter_job.job_id;
end
$$;

-- ── Хранилище секретов ─────────────────────────────────────────────────
create schema if not exists vault;

create table if not exists vault.decrypted_secrets (
  id               uuid primary key default gen_random_uuid(),
  name             text unique,
  decrypted_secret text
);

insert into vault.decrypted_secrets (name, decrypted_secret)
values ('service_role_key', 'test'), ('cron_shared_secret', 'test')
on conflict (name) do nothing;

-- ── Права, которые миграции раздают ролям Supabase ─────────────────────
grant usage on schema public, net, cron, vault, extensions
  to anon, authenticated, service_role;
