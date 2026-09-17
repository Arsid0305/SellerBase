-- Характеристики сравниваем по сути, а не по порядку.
--
-- ВБ отдаёт характеристики массивом {id, name, value} и каждый раз в
-- другом порядке. Проверка 17.09.2026: три синхронизации подряд дали одни
-- и те же 73 «изменения» - товар никто не трогал, просто переставились
-- строки. Из-за этого дата заливки была бы каждый день, то есть
-- бесполезна.
--
-- Поэтому перед сравнением приводим массив к одному виду: сортируем по id.

create or replace function public.canon_charcs(j jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when j is null or jsonb_typeof(j) <> 'array' then j
    else (select jsonb_agg(el order by (el->>'id')) from jsonb_array_elements(j) el)
  end;
$$;

comment on function public.canon_charcs(jsonb) is
  'Характеристики карточки в одном порядке - чтобы перестановка строк от ВБ не выглядела правкой.';

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
  if canon_charcs(new.characteristics) is distinct from canon_charcs(old.characteristics)
    then changed := array_append(changed, 'fields'); end if;

  foreach part in array changed loop
    insert into public.wb_card_uploads (my_article, nm_id, uploaded_on, scope, note)
    values (new.my_article, new.wb_article, current_date, part,
            'записано автоматически при синхронизации с ВБ')
    on conflict (nm_id, uploaded_on, scope) do nothing;
  end loop;

  return new;
end;
$$;

-- Условие на самом триггере тоже должно смотреть на суть, иначе он будет
-- срабатывать вхолостую на каждой перестановке.
drop trigger if exists trg_note_card_upload on public.sku_catalog;
create trigger trg_note_card_upload
  after update on public.sku_catalog
  for each row
  when (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.photo_url is distinct from old.photo_url
    or public.canon_charcs(new.characteristics) is distinct from public.canon_charcs(old.characteristics)
  )
  execute function public.note_card_upload();

-- Убираем 73 ложные записи от перестановки характеристик.
delete from public.wb_card_uploads
where note = 'записано автоматически при синхронизации с ВБ'
  and scope = 'fields'
  and uploaded_on = date '2026-09-17';

-- Временная таблица проверки больше не нужна.
drop table if exists public._proverka_charc;
