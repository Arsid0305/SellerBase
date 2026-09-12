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

-- ── pg_net и pg_cron ───────────────────────────────────────────────────
-- В образе supabase/postgres оба расширения уже стоят, и их функции
-- принадлежат supabase_admin: попытка подменить их своей заглушкой падает
-- с «must be owner of function http_post». Поэтому создаём заглушку
-- только там, где настоящей функции нет.

create schema if not exists net;
create schema if not exists cron;

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'net' and p.proname = 'http_post'
  ) then
    execute $f$
      create function net.http_post(
        url text,
        body jsonb default '{}'::jsonb,
        params jsonb default '{}'::jsonb,
        headers jsonb default '{}'::jsonb,
        timeout_milliseconds integer default 5000
      ) returns bigint language sql immutable as 'select 0::bigint'
    $f$;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'net' and p.proname = 'http_get'
  ) then
    execute $f$
      create function net.http_get(
        url text,
        params jsonb default '{}'::jsonb,
        headers jsonb default '{}'::jsonb,
        timeout_milliseconds integer default 5000
      ) returns bigint language sql immutable as 'select 0::bigint'
    $f$;
  end if;

  if to_regclass('cron.job') is null then
    execute $f$
      create table cron.job (
        jobid    bigserial primary key,
        schedule text,
        command  text,
        nodename text default 'localhost',
        nodeport integer default 5432,
        database text default current_database(),
        username text default current_user,
        active   boolean default true,
        jobname  text
      )
    $f$;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'cron' and p.proname = 'schedule'
  ) then
    execute $f$
      create function cron.schedule(job_name text, schedule text, command text)
      returns bigint language plpgsql as $b$
      declare id bigint;
      begin
        delete from cron.job where jobname = job_name;
        insert into cron.job (schedule, command, jobname)
        values (schedule, command, job_name) returning jobid into id;
        return id;
      end
      $b$
    $f$;
    execute $f$
      create function cron.schedule(schedule text, command text)
      returns bigint language sql as 'select cron.schedule(command, schedule, command)'
    $f$;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'cron' and p.proname = 'unschedule'
  ) then
    execute $f$
      create function cron.unschedule(job_name text)
      returns boolean language plpgsql as $b$
      begin
        delete from cron.job where jobname = job_name;
        return true;
      end
      $b$
    $f$;
    execute $f$
      create function cron.unschedule(job_id bigint)
      returns boolean language plpgsql as $b$
      begin
        delete from cron.job where jobid = job_id;
        return true;
      end
      $b$
    $f$;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'cron' and p.proname = 'alter_job'
  ) then
    execute $f$
      create function cron.alter_job(
        job_id bigint,
        schedule text default null,
        command text default null,
        database text default null,
        username text default null,
        active boolean default null
      ) returns void language plpgsql as $b$
      begin
        update cron.job j
           set schedule = coalesce(alter_job.schedule, j.schedule),
               command  = coalesce(alter_job.command, j.command),
               active   = coalesce(alter_job.active, j.active)
         where j.jobid = alter_job.job_id;
      end
      $b$
    $f$;
  end if;
end
$$;

-- ── Хранилище секретов ─────────────────────────────────────────────────
-- В образе supabase/postgres vault.decrypted_secrets уже есть и это view,
-- принадлежащий supabase_admin. Свою таблицу заводим только если объекта
-- нет вовсе, и наполняем только её.

create schema if not exists vault;

do $$
begin
  if to_regclass('vault.decrypted_secrets') is null then
    execute $f$
      create table vault.decrypted_secrets (
        id               uuid primary key default gen_random_uuid(),
        name             text unique,
        decrypted_secret text
      )
    $f$;
    execute $f$
      insert into vault.decrypted_secrets (name, decrypted_secret)
      values ('service_role_key', 'test'), ('cron_shared_secret', 'test')
    $f$;
  end if;
end
$$;

-- ── Права, которые миграции раздают ролям Supabase ─────────────────────
-- Схемы net, cron и vault в образе принадлежат supabase_admin: выдать
-- на них права от имени postgres нельзя, да и не нужно — они уже выданы.
do $$
declare s text;
begin
  foreach s in array array['public', 'net', 'cron', 'vault', 'extensions'] loop
    begin
      execute format('grant usage on schema %I to anon, authenticated, service_role', s);
    exception when insufficient_privilege or undefined_object then
      null;
    end;
  end loop;
end
$$;
