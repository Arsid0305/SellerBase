-- Долг схемы, часть 2 — закрывает остаток.
--
-- После первой части и удаления пустого в долге осталось 57 объектов.
-- Разобрал поимённо: это четыре таблицы со своими колонками, ключами и
-- индексами, плюс пять индексов на таблицах, которые в файлах уже есть.
-- Ни представлений, ни функций в остатке нет — прежняя запись в шапке
-- baseline про «недельный P&L и get_sources_by_period» устарела: оба
-- создаются миграциями 20260611003004 и 20260621000002.
--
-- Таблицы уведомлений и problems остались после того, как 12.09 удалили
-- четыре нижних уровня контура «расследований». Сама problems живая:
-- её читает страница «Проблемы» и ссылка с главной. Уведомления тоже
-- читаются кодом сайта, в каждой по одной строке.
--
-- Для рабочей базы миграция холостая: всё уже есть, формы записи
-- идемпотентные. Смысл — чтобы базу можно было собрать из файлов заново.

-- ── Проблемы ─────────────────────────────────────────────────────────────
create table if not exists public.problems (
  id             bigserial primary key,
  title          text not null,
  description    text,
  severity       text not null default 'med',
  scope_sku_id   bigint references public.sku_catalog(id) on delete set null,
  scope_category text,
  status         text not null default 'open',
  source         text not null default 'manual',
  detected_at    timestamptz not null default now(),
  resolved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists problems_status_idx on public.problems (status);

alter table public.problems enable row level security;

-- ── Уведомления ──────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id            bigserial primary key,
  kind          text not null,
  severity      text not null default 'info',
  title         text not null,
  body          text,
  link          text,
  is_read       boolean not null default false,
  sent_telegram boolean not null default false,
  sent_push     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_read_idx
  on public.notifications (is_read, created_at desc);

-- Одна строка настроек на всю систему — отсюда проверка id = 1.
create table if not exists public.notification_settings (
  id               integer not null default 1 primary key,
  quiet_from       integer not null default 23,
  quiet_to         integer not null default 8,
  telegram_enabled boolean not null default true,
  push_enabled     boolean not null default true,
  bell_enabled     boolean not null default true,
  rules            jsonb   not null default '{}'::jsonb,
  constraint notification_settings_id_check check (id = 1)
);

create table if not exists public.notification_subscribers (
  id              bigserial primary key,
  channel         text not null,
  telegram_chat_id text,
  push_endpoint   text,
  push_p256dh     text,
  push_auth       text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  constraint notification_subscribers_channel_check
    check (channel = any (array['telegram'::text, 'push'::text])),
  constraint notification_subscribers_channel_telegram_chat_id_key
    unique (channel, telegram_chat_id),
  constraint notification_subscribers_channel_push_endpoint_key
    unique (channel, push_endpoint)
);

alter table public.notifications             enable row level security;
alter table public.notification_settings     enable row level security;
alter table public.notification_subscribers  enable row level security;

-- ── Индексы ──────────────────────────────────────────────────────────────
--
-- Два из них уже описаны миграциями, но в рабочей базе называются короче:
-- personas_source_idx против customer_personas_source_idx и
-- scenarios_source_idx против purchase_scenarios_source_idx. Сверка видела
-- и те и другие, как будто их четыре.
--
-- Заводить вторые с именами рабочей базы нельзя — в собранной из файлов
-- базе получилось бы по два одинаковых индекса на колонку. Поэтому не
-- создаём, а переименовываем: в рабочей базе имя станет как в файлах,
-- в собранной из файлов индекс уже назван правильно и строка ничего
-- не делает.
alter index if exists public.personas_source_idx
  rename to customer_personas_source_idx;
alter index if exists public.scenarios_source_idx
  rename to purchase_scenarios_source_idx;

-- Эти три есть только в рабочей базе — их описываем.
create index if not exists wb_reports_fact_oper_idx
  on public.wb_reports_fact (supplier_oper_name);
create index if not exists wb_tariffs_box_date_idx
  on public.wb_tariffs_box (effective_date desc);
create index if not exists wb_tariffs_box_wh_idx
  on public.wb_tariffs_box (warehouse_name);
