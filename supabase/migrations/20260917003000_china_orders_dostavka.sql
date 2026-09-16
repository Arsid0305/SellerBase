-- Владелица 17.09: в заказе нужны курс юаня и доллара, стоимость товара,
-- вся доставка до Южных Ворот, вес, ставка за кг и доставка по Москве.
-- Раньше это лежало одной строкой в комментарии.

alter table public.china_orders
  add column if not exists usd_rate_rub numeric(10,4),
  add column if not exists services_yuan numeric(14,2),
  add column if not exists china_delivery_yuan numeric(14,2),
  add column if not exists total_weight_kg numeric(12,2),
  add column if not exists freight_usd_per_kg numeric(10,2),
  add column if not exists freight_rub numeric(14,2),
  add column if not exists moscow_delivery_rub numeric(14,2);

comment on column public.china_orders.usd_rate_rub is 'Курс доллара доставки, ₽.';
comment on column public.china_orders.services_yuan is 'Услуги посредника в Китае, ¥.';
comment on column public.china_orders.china_delivery_yuan is 'Доставка внутри Китая, ¥.';
comment on column public.china_orders.total_weight_kg is 'Вес поставки с упаковкой и обрешёткой, кг.';
comment on column public.china_orders.freight_usd_per_kg is 'Ставка фрахта Китай — Южные Ворота, $ за кг.';
comment on column public.china_orders.freight_rub is 'Доставка Китай — Южные Ворота, ₽.';
comment on column public.china_orders.moscow_delivery_rub is 'Доставка по Москве, Южные Ворота — фулфилмент, ₽.';

update public.china_orders
   set usd_rate_rub = 88, services_yuan = 976.89, china_delivery_yuan = 935,
       total_weight_kg = 728.70, freight_usd_per_kg = 3.5,
       freight_rub = 253088, moscow_delivery_rub = 23100,
       comment = 'Заказ №1281-23'
 where comment like 'Заказ №1281-23%';
