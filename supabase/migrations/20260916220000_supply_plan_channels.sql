-- План отгрузки под каналы владелицы вместо складов.
--
-- Было: строка на склад (warehouse_name). Модель устарела — на WB отгрузка
-- идёт в одну точку, WB сам развозит. По Ozon владелица раскидывает сама,
-- в систему отдаёт одно число: «озон не разноси, бери итого как и вб».
--
-- Стало: строка на канал. Когда добавится площадка или схема, добавится
-- значение, а таблицу переделывать не придётся.
--
-- Обе таблицы были пусты, данные не терялись.

alter table public.supply_plans
  add column if not exists plan_date date,
  add column if not exists source text;

alter table public.supply_plan_items
  drop column if exists warehouse_name;

alter table public.supply_plan_items
  add column if not exists channel text;

update public.supply_plan_items set channel = 'fbo_wb' where channel is null;

alter table public.supply_plan_items
  alter column channel set not null;

alter table public.supply_plan_items
  drop constraint if exists supply_plan_items_channel_chk;

alter table public.supply_plan_items
  add constraint supply_plan_items_channel_chk
  check (channel in ('fbo_wb', 'fbo_ozon', 'fbs'));

create unique index if not exists supply_plan_items_plan_sku_channel_uidx
  on public.supply_plan_items (plan_id, sku_id, channel);

comment on table public.supply_plans is
  'Партии отгрузки. Одна строка на партию, состав — в supply_plan_items.';
comment on column public.supply_plans.plan_date is
  'Дата отгрузки партии.';
comment on column public.supply_plans.source is
  'Откуда взята партия: tz_ff — техзадание на фулфилмент.';
comment on table public.supply_plan_items is
  'Состав партии: товар × канал × количество. Каналы: fbo_wb, fbo_ozon, fbs.';
comment on column public.supply_plan_items.channel is
  'Канал отгрузки: fbo_wb — ФБО Wildberries, fbo_ozon — ФБО Ozon, fbs — ФБС (обе площадки).';
