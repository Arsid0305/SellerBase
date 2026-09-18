-- Расходы Ozon: отчёт о движении денег, понедельно.
--
-- Отчёт о реализации (ozon_realization) даёт только продажу и ставку Ozon.
-- Логистика, хранение, продвижение, эквайринг, штрафы и платная приёмка
-- живут в другом отчёте - о движении денег. Владелица ведёт их в своём
-- файле P&L отдельными строками, программа должна уметь то же.
--
-- Ozon режет этот отчёт по неделям, не по месяцам. Неделю не ломаем:
-- храним как отдал источник, а по месяцам раскладываем представлением.

create table if not exists public.ozon_cashflow (
  period_begin                   date        primary key,
  period_end                     date        not null,
  orders_amount                  numeric,
  returns_amount                 numeric,
  commission_amount              numeric,
  services_amount                numeric,
  item_delivery_and_return_amount numeric,
  payments_amount                numeric,
  begin_balance_amount           numeric,
  end_balance_amount             numeric,
  raw                            jsonb,
  fetched_at                     timestamptz not null default now()
);

comment on table public.ozon_cashflow is
  'Движение денег Ozon по неделям. Итоги недели; разбивка по услугам - в ozon_services.';

-- Разбивка по услугам. Имена услуг Ozon отдаёт своими кодами
-- (MarketplaceServiceItem...), человеческие названия навешиваем представлением.
create table if not exists public.ozon_services (
  period_begin date    not null references public.ozon_cashflow(period_begin) on delete cascade,
  block        text    not null check (block in ('delivery', 'return', 'services', 'others')),
  name         text    not null,
  price        numeric not null,
  primary key (period_begin, block, name)
);

comment on table public.ozon_services is
  'Услуги Ozon за неделю: имя услуги как её называет Ozon и сумма. Минус - расход.';

create index if not exists ozon_services_name_idx on public.ozon_services (name);

alter table public.ozon_cashflow enable row level security;
alter table public.ozon_services enable row level security;
