-- История остатков должна помнить замороженные склады: до 16.08.2026 товар
-- на них был настоящим, и по этой истории считается хранение и оборачиваемость.
-- Из «чистой» истории убираем только то, что складом никогда не было: итоги,
-- свёртки и товар в пути.
--
-- Без этой правки предыдущая миграция обнулила бы всю историю до 16 августа:
-- «чистый» взгляд выбрасывал любую строку, попавшую в справочник служебных.

create or replace view public.v_wb_stocks_history_clean as
select id, snapshot_date, barcode, nm_id, warehouse_name,
       quantity, in_way_to_client, in_way_from_client
from wb_stocks_history h
where not exists (
  select 1 from wb_stock_service_rows s
  where s.warehouse_name = h.warehouse_name
    and s.kind <> 'frozen'
);
