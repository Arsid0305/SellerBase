-- Владелица 17.09: «35 фулфилмента надо отдельно считать, не плюсовать в себес».
--
-- Отгрузка силами фулфилмента на ПВЗ Ozon и WB — 35 ₽ за единицу — это
-- расход на доставку до площадки, а не стоимость самого товара.
-- В себестоимости остаётся карго + индивидуальная обработка.
--
-- Правим только записи от 16.09.2026 из файла UNIT, прошлые партии не трогаем.

update public.sku_cost_history
   set cost_rub = cost_rub - 35
 where valid_from = date '2026-09-16'
   and source = 'unit_xlsx_2026-09-16'
   and cost_rub > 35;

update public.sku_catalog s
   set cost_price_rub = h.cost_rub
  from public.sku_cost_history h
 where h.sku_id = s.id
   and h.valid_from = date '2026-09-16'
   and h.valid_to is null
   and h.source = 'unit_xlsx_2026-09-16';

-- Тариф ФФ 35 ₽ теперь живёт отдельной колонкой
update public.sku_catalog set manual_ff_tariff_rub = 35 where is_active;

comment on column public.sku_catalog.cost_price_rub is
  'Себестоимость единицы: карго (товар + доставка из Китая + транспорт до фулфилмента) + индивидуальная обработка. Отгрузка ФФ на ПВЗ (35 ₽) сюда НЕ входит — с 17.09.2026 считается отдельно.';
comment on column public.sku_catalog.manual_ff_tariff_rub is
  'Тариф фулфилмента за единицу, ₽. Отгрузка силами ФФ на ПВЗ Ozon и WB. С 17.09.2026 — 35 ₽.';
