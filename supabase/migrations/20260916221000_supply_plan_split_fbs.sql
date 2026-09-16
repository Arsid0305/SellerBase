-- Владелица 16.09: «фбс озон - фбс вб - разбей».
-- ФБС раскладывается на две площадки, как и ФБО. Итого четыре канала.
--
-- В техзадании на фулфилмент ФБС пока идёт одним числом (2 124 штуки),
-- без разбивки по площадкам, поэтому значение 'fbs' оставлено как
-- переходное — для партий, где разбивки ещё нет.

alter table public.supply_plan_items
  drop constraint if exists supply_plan_items_channel_chk;

alter table public.supply_plan_items
  add constraint supply_plan_items_channel_chk
  check (channel in ('fbo_wb', 'fbo_ozon', 'fbs_wb', 'fbs_ozon', 'fbs'));

comment on column public.supply_plan_items.channel is
  'Канал отгрузки: fbo_wb, fbo_ozon, fbs_wb, fbs_ozon. Значение fbs — переходное, для партий, где ФБС ещё не разбит по площадкам.';
