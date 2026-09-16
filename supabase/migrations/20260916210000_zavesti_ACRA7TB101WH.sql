-- Таблетница круглая 7*2 белая Д — нет в каталоге, хотя карточка на WB есть.
-- Владелица 16.09.2026: «заведи с вб».
--
-- Данные: артикул и nm_id из wb_product_facts (запись от 27.08.2026),
-- штрихкод из её файла себестоимости, себестоимость 261.02 — та же, что у
-- двух сестёр по группе (ACRA7TB101BC и ACRA7TB101CL).
--
-- Название, бренд, категорию и фото подтянет fetch-wb-content с WB: эта
-- функция обновляет каталог по совпадению wb_article, но новые строки не
-- заводит — поэтому строку создаём здесь.

insert into public.sku_catalog (my_article, wb_article, barcode, cost_price_rub, cost_price_source, bundle_type, is_active)
select 'ACRA7TB101WH', 1426871693, '2054786826888', 261.02, 'unit_xlsx_2026-09-16', 'single', true
where not exists (select 1 from public.sku_catalog where wb_article = 1426871693);

insert into public.sku_cost_history (sku_id, cost_rub, valid_from, valid_to, source)
select s.id, 261.02, date '2026-09-16', null, 'unit_xlsx_2026-09-16'
  from public.sku_catalog s
 where s.wb_article = 1426871693
   and not exists (
     select 1 from public.sku_cost_history h
      where h.sku_id = s.id and h.valid_from = date '2026-09-16');
