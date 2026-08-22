-- Снимок контента карточки: название, описание, характеристики на дату.
--
-- Зачем отдельная таблица, а не расширение sku_snapshots: та снимает витрину
-- (цена, рейтинг, число отзывов) и полей description / characteristics не имеет
-- ни в колонках, ни в raw — проверено 22.08.2026. Плюс она мертва с 05.06.
-- Здесь снимается ровно то, что правит SEO.
--
-- Смысл: sku_catalog хранит только текущее состояние, fetch-wb-content
-- перезаписывает его поверх. После заливки новых описаний старый текст
-- исчезает безвозвратно — WB прошлые версии не отдаёт. Эта таблица держит
-- точку отсчёта, чтобы можно было сказать «до правки конверсия была такой».
create table if not exists public.sku_content_snapshots (
  id              bigserial primary key,
  snapshot_date   date        not null default current_date,
  my_article      text        not null,
  wb_article      bigint,
  subject_name    text,
  title           text,
  description     text,
  characteristics jsonb,
  photo_url       text,
  -- Зачем снимали. Первый снимок — 'before_seo_upload', состояние до заливки
  -- 39 описаний из docs/seo/descriptions/.
  reason          text        not null default 'manual',
  created_at      timestamptz not null default now(),
  -- Идемпотентность: повторный снимок за тот же день перезаписывает,
  -- а не плодит дубли (принцип проекта — UPSERT).
  constraint sku_content_snapshots_uniq unique (my_article, snapshot_date)
);

create index if not exists sku_content_snapshots_article_idx
  on public.sku_content_snapshots (my_article, snapshot_date desc);

comment on table public.sku_content_snapshots is
  'Снимки контента карточек (название, описание, характеристики) на дату. Точка отсчёта для оценки эффекта правок SEO: sku_catalog хранит только текущее состояние и перезаписывается fetch-wb-content, старый текст WB не отдаёт.';
comment on column public.sku_content_snapshots.reason is
  'Зачем снимали: before_seo_upload — состояние до заливки описаний; manual — разовый снимок.';

-- Первый снимок — состояние «до» на 22.08.2026, снят перед заливкой описаний.
-- Идемпотентно: повторный прогон за тот же день обновит, а не задвоит.
insert into public.sku_content_snapshots
  (snapshot_date, my_article, wb_article, subject_name, title, description, characteristics, photo_url, reason)
select current_date, c.my_article, c.wb_article, c.subject_name, c.title,
       c.description, c.characteristics, c.photo_url, 'before_seo_upload'
from public.sku_catalog c
where c.my_article is not null
on conflict (my_article, snapshot_date) do update set
  wb_article      = excluded.wb_article,
  subject_name    = excluded.subject_name,
  title           = excluded.title,
  description     = excluded.description,
  characteristics = excluded.characteristics,
  photo_url       = excluded.photo_url,
  reason          = excluded.reason,
  created_at      = now();
