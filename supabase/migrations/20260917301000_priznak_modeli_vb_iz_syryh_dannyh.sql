-- Признак модели ВБ считаем из сырого ответа площадки, а не переписываем сбор.
--
-- Предыдущая миграция завела обычную колонку warehouse_type, и её надо было
-- бы заполнять правкой функции сбора. Но отчёт ВБ уже лежит в таблице целиком,
-- в колонке raw, и поле warehouseType есть во всех 905 строках за всю
-- историю. Проверено запросом.
--
-- Поэтому колонка становится вычисляемой. Что это даёт:
--   · вся история заполняется сама, задним числом;
--   · значение не может разойтись с источником - оно и есть источник;
--   · функцию сбора и её пять общих модулей переписывать не нужно.
--
-- Правило: если площадка уже отдала поле и мы сохранили ответ целиком -
-- новый столбец считаем из ответа, а не заводим второй путь записи.

alter table public.wb_sales_fact drop column if exists warehouse_type;

alter table public.wb_sales_fact
  add column warehouse_type text
  generated always as (raw->>'warehouseType') stored;

comment on column public.wb_sales_fact.warehouse_type is
  'Тип склада из ответа ВБ. «Склад WB» - ФБО, склад продавца - ФБС. Считается из raw.';

create index if not exists wb_sales_fact_warehouse_type_idx
  on public.wb_sales_fact (warehouse_type);
