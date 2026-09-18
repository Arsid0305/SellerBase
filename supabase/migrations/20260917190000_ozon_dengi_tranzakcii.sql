-- Ozon, шаг третий: деньги.
-- План контура - docs/integrations/OZON_PODKLYUCHENIE.md.
--
-- Ozon отдаёт деньги списком операций: продажа, возврат, услуги, компенсации.
-- У каждой операции своё начисление за товар, своя комиссия и свой список
-- услуг с суммами. Складывать это в наши колонки «комиссия / логистика /
-- хранение» вслепую нельзя - у Ozon свои названия статей. Поэтому сначала
-- храним как приходит, а разбор статей делаем потом, посмотрев на живые
-- названия и показав их владелице.
--
-- services и items оставляем целиком: в них сидят названия услуг и состав
-- операции, без которых не разложить расходы по товарам.

create table if not exists public.ozon_transactions (
  operation_id        bigint primary key,
  operation_type      text,
  operation_type_name text,
  operation_date      timestamptz,
  posting_number      text,
  order_date          timestamptz,
  warehouse_name      text,
  type                text,
  accruals_for_sale   numeric(14,2),
  sale_commission     numeric(14,2),
  delivery_charge     numeric(14,2),
  return_delivery_charge numeric(14,2),
  amount              numeric(14,2),
  services            jsonb,
  items               jsonb,
  raw                 jsonb,
  fetched_at          timestamptz not null default now()
);

create index if not exists ozon_transactions_date_idx on public.ozon_transactions (operation_date);
create index if not exists ozon_transactions_posting_idx on public.ozon_transactions (posting_number);
create index if not exists ozon_transactions_type_idx on public.ozon_transactions (operation_type);

comment on table public.ozon_transactions is
  'Денежные операции Ozon: продажи, возвраты, услуги, компенсации. Хранятся как приходят, разбор статей - отдельно.';

alter table public.ozon_transactions enable row level security;
