-- Поставки FBW: схема под новую форму ответа WB (проверено 04.09.2026).
--
-- Что случилось: WB перевёл список поставок с GET на POST и полностью сменил
-- форму ответа. Функция ждала {next, supplies:[{id, name, warehouseName, status,
-- boxesCount}]}, а приходит плоский массив
-- [{phone, supplyID, preorderID, createDate, supplyDate, factDate, updatedDate,
--   statusID, boxTypeID, isBoxOnPallet}] — без имени, склада и числа коробов.
-- Отсюда 160 ошибок 405 и отключённые задания.
--
-- Недостающее отдаёт GET /api/v1/supplies/{id}: склад (плановый, фактический,
-- транзитный), количества по стадиям приёмки, причина отказа и — важное для
-- юнит-экономики — acceptanceCost, стоимость платной приёмки.
--
-- Старые колонки не трогаем: name, status и boxes_count хранят прежние данные,
-- их читает страница /supplies. status теперь заполняется расшифровкой statusID.

ALTER TABLE public.wb_supplies_v2
  ADD COLUMN IF NOT EXISTS supply_id_num             bigint,
  ADD COLUMN IF NOT EXISTS preorder_id               bigint,
  ADD COLUMN IF NOT EXISTS status_id                 integer,
  ADD COLUMN IF NOT EXISTS box_type_id               integer,
  ADD COLUMN IF NOT EXISTS is_box_on_pallet          boolean,
  ADD COLUMN IF NOT EXISTS supply_date               timestamptz,
  ADD COLUMN IF NOT EXISTS fact_date                 timestamptz,
  ADD COLUMN IF NOT EXISTS updated_date              timestamptz,
  ADD COLUMN IF NOT EXISTS actual_warehouse_id       bigint,
  ADD COLUMN IF NOT EXISTS actual_warehouse_name     text,
  ADD COLUMN IF NOT EXISTS transit_warehouse_name    text,
  ADD COLUMN IF NOT EXISTS acceptance_cost           numeric,
  ADD COLUMN IF NOT EXISTS paid_acceptance_coef      numeric,
  ADD COLUMN IF NOT EXISTS reject_reason             text,
  ADD COLUMN IF NOT EXISTS quantity                  integer,
  ADD COLUMN IF NOT EXISTS ready_for_sale_quantity   integer,
  ADD COLUMN IF NOT EXISTS accepted_quantity         integer,
  ADD COLUMN IF NOT EXISTS unloading_quantity        integer,
  ADD COLUMN IF NOT EXISTS details_fetched_at        timestamptz;

COMMENT ON COLUMN public.wb_supplies_v2.supply_id_num  IS 'supplyID из WB; null у преордера, который ещё не стал поставкой';
COMMENT ON COLUMN public.wb_supplies_v2.preorder_id    IS 'preorderID — есть всегда, в том числе до появления supplyID';
COMMENT ON COLUMN public.wb_supplies_v2.acceptance_cost IS 'Стоимость платной приёмки, ₽ — идёт в себестоимость поставки';
COMMENT ON COLUMN public.wb_supplies_v2.updated_date   IS 'Когда WB последний раз менял поставку; по нему функция решает, обновлять ли детали';

-- Детали тянутся не для всех сразу: очередь строится по этому индексу.
CREATE INDEX IF NOT EXISTS wb_supplies_v2_details_queue_idx
  ON public.wb_supplies_v2 (details_fetched_at NULLS FIRST, updated_date DESC);

ALTER TABLE public.wb_supply_items_v2
  ADD COLUMN IF NOT EXISTS vendor_code              text,
  ADD COLUMN IF NOT EXISTS tnved                    text,
  ADD COLUMN IF NOT EXISTS color                    text,
  ADD COLUMN IF NOT EXISTS need_kiz                 boolean,
  ADD COLUMN IF NOT EXISTS ready_for_sale_quantity  integer,
  ADD COLUMN IF NOT EXISTS unloading_quantity       integer,
  ADD COLUMN IF NOT EXISTS accepted_quantity        integer;

COMMENT ON COLUMN public.wb_supply_items_v2.need_kiz IS 'Требуется ли код маркировки «Честного ЗНАКа» — WB отдаёт это по каждой позиции поставки';

-- Расшифровка statusID НЕ заводится. В ответе встречаются 1 и 5, но словаря
-- статусов WB не отдаёт (/supplies/statuses → 400), а таблица wb_supplies_v2
-- пуста — функция ни разу не отработала, сверить не с чем. Выдумывать названия
-- нельзя: в интерфейсе появится подпись, за которой нет факта.
--
-- Как закрыть: владелица открывает кабинет и называет статус двух-трёх поставок
-- по номеру, дальше сопоставляем с их statusID и заводим словарь отдельной
-- миграцией. Пока в UI показывается номер статуса как есть.
