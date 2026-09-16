-- Владелица 17.09: «курс последнего юаня и доллара и доставка на кг».
-- Прежняя запись была от 14.01.2026: курс 11,8 ₽ и доставка 0 ¥/кг.
-- Заводим по заказу 1281-23: юань 13,3 ₽, доллар доставки 88 ₽,
-- фрахт 3,5 $/кг, в юанях за кг 3,5 × 88 ÷ 13,3 = 23,16.

insert into public.cargo_tariffs (effective_from, cny_rate_rub, usd_rate_rub, cny_delivery_per_kg, comment)
select date '2026-09-16', 13.3, 88, 23.16, 'По заказу №1281-23: фрахт 3,5 $/кг, курс доллара товара 82 ₽'
where not exists (select 1 from public.cargo_tariffs where effective_from = date '2026-09-16');
