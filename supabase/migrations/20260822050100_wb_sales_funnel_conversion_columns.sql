-- WB отдаёт в воронке конверсии и избранное, функция их не забирала.
-- Конверсия в корзину — главный сигнал качества карточки: просмотр есть, корзины нет
-- значит не убеждают наименование, фото и описание. Ровно то, что чинит SEO.
-- Расширяем добавлением, существующие столбцы не трогаем.
alter table public.wb_sales_funnel
  add column if not exists add_to_wishlist_count integer not null default 0,
  add column if not exists add_to_cart_conversion numeric not null default 0,
  add column if not exists cart_to_order_conversion numeric not null default 0,
  add column if not exists buyout_percent numeric not null default 0;

comment on column public.wb_sales_funnel.add_to_cart_conversion is
  'Конверсия в корзину, % — считает WB (поле addToCartConversion), не пересчитываем.';
comment on column public.wb_sales_funnel.cart_to_order_conversion is
  'Конверсия корзина → заказ, % — поле WB cartToOrderConversion.';
comment on column public.wb_sales_funnel.buyout_percent is
  'Процент выкупа по данным WB (buyoutPercent).';
comment on column public.wb_sales_funnel.add_to_cart_count is
  'Добавления в корзину. Источник — поле WB cartCount. С 14.06 по 14.08.2026 функция читала устаревшее addToCartCount, поэтому за эти даты стоят нули; перезабрать их нельзя — WB не отдаёт историю глубже недели. Достоверно с 15.08.2026.';
