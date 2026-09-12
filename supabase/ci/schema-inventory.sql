-- Перечень объектов схемы public: таблицы с колонками, представления,
-- функции, ключи и индексы. Одна строка — один объект.
--
-- Зачем не дамп. Прод работает на PostgreSQL 17, тестовая база в проверках —
-- на 15. Дампы этих версий отличаются оформлением, и сравнивать их
-- бессмысленно: разница будет всегда. Перечень объектов от версии
-- не зависит.
--
-- Что намеренно не сравнивается:
--   • содержимое функций — оно часто переписывается целиком, и шум забьёт
--     настоящие находки. Сравнивается имя, аргументы и тип результата;
--   • схемы net, cron, vault — в тестовой базе это заглушки;
--   • объекты расширений: pgtap ставит около тысячи своих функций в public,
--     и без фильтра сравнение утонуло бы в них;
--   • комментарии, владельцы, права — они у прода и у чистой базы разные
--     по устройству, а не по содержанию.

\pset tuples_only on
\pset format unaligned

select line from (

  select 'table  ' || table_name || '.' || column_name || ' ' ||
         case
           when data_type = 'numeric' and numeric_precision is not null
             then 'numeric(' || numeric_precision || ',' || numeric_scale || ')'
           when data_type = 'character varying' then 'text'
           when data_type = 'timestamp with time zone' then 'timestamptz'
           else data_type
         end ||
         case when is_nullable = 'NO' then ' not_null' else '' end as line
    from information_schema.columns
   where table_schema = 'public'
     and table_name in (
           select c.relname from pg_class c
             join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r'
              and not exists (select 1 from pg_depend d
                               where d.objid = c.oid and d.deptype = 'e'))

  union all
  select 'view   ' || c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     and not exists (select 1 from pg_depend d
                      where d.objid = c.oid and d.deptype = 'e')

  union all
  select 'func   ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') -> '
         || pg_get_function_result(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind in ('f', 'p')
     and not exists (select 1 from pg_depend d
                      where d.objid = p.oid and d.deptype = 'e')

  union all
  select 'constr ' || c.relname || ' ' || con.conname || ' ' || pg_get_constraintdef(con.oid)
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and con.contype in ('p', 'u', 'f')

  union all
  select 'index  ' || indexname || ' ' || replace(indexdef, 'public.', '')
    from pg_indexes
   where schemaname = 'public'

) t
order by line;
