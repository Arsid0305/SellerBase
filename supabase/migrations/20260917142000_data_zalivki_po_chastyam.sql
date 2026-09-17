-- Приводим автозапись даты заливки к тому, как таблица задумана.
-- У wb_card_uploads.scope есть проверка: одно значение из списка
-- title / fields / description / infographic / video. То есть строка - это
-- «что именно поменялось», а не перечисление через запятую.
--
-- Поэтому пишем по строке на каждую изменившуюся часть карточки:
--   название        → title
--   описание        → description
--   главное фото    → infographic
--   характеристики  → fields
--
-- Ключ - товар, день и часть карточки: за один день по одному товару
-- каждая часть отмечается один раз.

drop index if exists public.wb_card_uploads_nm_day_uq;

create unique index if not exists wb_card_uploads_nm_day_scope_uq
  on public.wb_card_uploads (nm_id, uploaded_on, scope);

create or replace function public.note_card_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed text[] := '{}';
  part    text;
begin
  if new.title is distinct from old.title then changed := array_append(changed, 'title'); end if;
  if new.description is distinct from old.description then changed := array_append(changed, 'description'); end if;
  if new.photo_url is distinct from old.photo_url then changed := array_append(changed, 'infographic'); end if;
  if new.characteristics is distinct from old.characteristics then changed := array_append(changed, 'fields'); end if;

  foreach part in array changed loop
    insert into public.wb_card_uploads (my_article, nm_id, uploaded_on, scope, note)
    values (new.my_article, new.wb_article, current_date, part,
            'записано автоматически при синхронизации с ВБ')
    on conflict (nm_id, uploaded_on, scope) do nothing;
  end loop;

  return new;
end;
$$;
