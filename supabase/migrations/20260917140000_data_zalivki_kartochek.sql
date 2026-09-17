-- Дата заливки карточек записывается сама.
-- Решение владелицы 17.09.2026: «за карточек записывать обязательно».
--
-- Зачем. Она залила новые карточки и готовит тест новой инфографики.
-- Без даты заливки вопрос «сработало или нет» останется без ответа:
-- не с чем сравнить конверсию до и после. Просить записывать руками -
-- значит однажды забыть, поэтому пишем автоматически.
--
-- Как. Карточки приезжают из ВБ в sku_catalog. Триггер сравнивает
-- название, описание, главное фото и характеристики со старым значением;
-- если что-то поменялось - в wb_card_uploads появляется строка с датой.
-- Триггер ловит любое изменение, хоть из загрузчика, хоть руками.
--
-- Одна строка на товар в день: если за день поменялись и название, и фото,
-- в scope окажется и то и другое.

create unique index if not exists wb_card_uploads_nm_day_uq
  on public.wb_card_uploads (nm_id, uploaded_on);

create or replace function public.note_card_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed text[] := '{}';
begin
  if new.title is distinct from old.title then changed := array_append(changed, 'название'); end if;
  if new.description is distinct from old.description then changed := array_append(changed, 'описание'); end if;
  if new.photo_url is distinct from old.photo_url then changed := array_append(changed, 'фото'); end if;
  if new.characteristics is distinct from old.characteristics then changed := array_append(changed, 'характеристики'); end if;

  if array_length(changed, 1) is null then
    return new;
  end if;

  insert into public.wb_card_uploads (my_article, nm_id, uploaded_on, scope, note)
  values (new.my_article, new.wb_article, current_date,
          array_to_string(changed, ', '),
          'записано автоматически при синхронизации с ВБ')
  on conflict (nm_id, uploaded_on) do update
    set scope = (
      select string_agg(distinct s, ', ')
      from unnest(string_to_array(wb_card_uploads.scope || ', ' || excluded.scope, ', ')) s
    );

  return new;
end;
$$;

drop trigger if exists trg_note_card_upload on public.sku_catalog;
create trigger trg_note_card_upload
  after update on public.sku_catalog
  for each row
  when (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.photo_url is distinct from old.photo_url
    or new.characteristics is distinct from old.characteristics
  )
  execute function public.note_card_upload();

comment on table public.wb_card_uploads is
  'Когда менялась карточка товара. Заполняется триггером при синхронизации с ВБ. Нужна, чтобы сравнивать конверсию до и после заливки.';
