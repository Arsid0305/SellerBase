-- Фикс: helper-функции должны ссылаться на public.app_settings,
-- иначе при search_path='' их вызов падает с "relation app_settings does not exist".

create or replace function app_setting_num(p_key text)
returns numeric language sql stable
set search_path = ''
as $$
  select value::numeric from public.app_settings where key = p_key;
$$;

create or replace function app_setting_text(p_key text)
returns text language sql stable
set search_path = ''
as $$
  select value from public.app_settings where key = p_key;
$$;
