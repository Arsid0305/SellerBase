-- Настройка бокового меню: порядок пунктов, разделительные черты, скрытие.
-- Просьба владелицы 16.09.2026: «сделать возможность строки меню тусовать
-- по моему усмотрению и добавлять разделительную черту», плюс прятать
-- пункт, не удаляя его.
--
-- Кабинет один, поэтому строка ровно одна (id = 1). entries хранит
-- порядок целиком: [{"kind":"item","href":"/dashboard","hidden":false},
--                   {"kind":"divider","label":"Операции"}]
-- Пункты, которых нет в entries, показываются в конце - так новый раздел
-- программы не потеряется после обновления.

create table if not exists public.ui_menu_layout (
  id smallint primary key default 1,
  entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint ui_menu_layout_single_row check (id = 1)
);

alter table public.ui_menu_layout enable row level security;

comment on table public.ui_menu_layout is
  'Пользовательский порядок бокового меню: пункты, разделители, скрытые пункты. Одна строка на кабинет.';
comment on column public.ui_menu_layout.entries is
  'Массив: {"kind":"item","href":"...","hidden":bool} или {"kind":"divider","label":"..."}';
