-- Владелица 16.09: «склад ФБС общий, всё-таки разбивать нечего.
-- А вот продажи будут дифференцироваться».
--
-- Для плана отгрузки каналов три, а не четыре: ФБС один общий.
-- Разделение по площадкам нужно на продажах — это другой контур.
--
-- Догружает ФБС в партию «ТЗ ФФ, сентябрь 2026»: 2 124 штуки по 53 товарам.
-- Полный текст миграции применён через MCP, здесь он записан для истории.

alter table public.supply_plan_items
  drop constraint if exists supply_plan_items_channel_chk;

alter table public.supply_plan_items
  add constraint supply_plan_items_channel_chk
  check (channel in ('fbo_wb', 'fbo_ozon', 'fbs'));

comment on column public.supply_plan_items.channel is
  'Канал отгрузки: fbo_wb — ФБО Wildberries, fbo_ozon — ФБО Ozon, fbs — ФБС, склад общий на обе площадки. Разделение ФБС по площадкам идёт на продажах, не здесь.';
