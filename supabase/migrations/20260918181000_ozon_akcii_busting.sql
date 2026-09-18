-- Бустинг в акциях Ozon.
--
-- Проверено живым запросом 18.09.2026: /v1/actions/products отдаёт по каждому
-- товару не только акционную цену, но и продвижение, которое за неё дают.
-- Пример из кабинета: товар стоит 643 ₽ и получает бустинг 15. Опустить до
-- 545 ₽ - бустинг станет 55.
--
-- Это и есть содержание акции «Эластичный бустинг»: чем ниже цена, тем выше
-- товар показывают. Без этих колонок в акции видно только цену, и решение
-- «стоит ли ронять цену» принимать не из чего.

alter table public.ozon_action_products
  add column if not exists busting_seychas   integer,
  add column if not exists busting_max       integer,
  add column if not exists cena_dlya_max_busting numeric;

comment on column public.ozon_action_products.busting_seychas is
  'Продвижение, которое Ozon даёт за текущую акционную цену.';
comment on column public.ozon_action_products.busting_max is
  'Максимальное продвижение по этой акции.';
comment on column public.ozon_action_products.cena_dlya_max_busting is
  'Цена, при которой продвижение станет максимальным.';
