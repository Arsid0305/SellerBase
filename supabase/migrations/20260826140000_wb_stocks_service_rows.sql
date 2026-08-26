-- Приём остатков: служебные строки WB, товар в пути и протухшие строки.
--
-- WB отдаёт в warehouse_remains служебные строки вперемешку с настоящими складами,
-- а fetch-wb-stocks принимал их за склады. Три следствия, все три чинятся здесь:
--
-- 1. `Всего находится на складах` — итог, который уже просуммировал склады. На срезе
--    26.08 он равен 8 019 при 8 019 по настоящим складам, то есть удваивал остаток.
-- 2. `В пути до получателей` и `В пути возвраты на склад WB` — товар в пути, не склад.
--    Поля in_way_to_client / in_way_from_client при этом приходят нулями: WB перестал
--    их заполнять, и весь товар в пути живёт только в этих строках. Просто выбросить
--    их нельзя — данные потеряются, поэтому под них отдельная таблица.
-- 3. `wb_stocks` — UPSERT без удаления, поэтому строки складов, выпавших из отчёта,
--    оставались навсегда. На 26.08 в таблице 27 860 штук при 8 019 настоящих:
--    10 287 — мусор со старых прогонов, включая склады, закрытые после ударов в июле.
--
-- Чиним сам `wb_stocks` (это текущий снапшот, производная), а не историю.
-- `wb_stocks_history` — первоисточник и доказательство, его не переписываем никогда:
-- в нём лежат ежедневные срезы по складам поимённо с 01.06.2026, снятые до того,
-- как WB убрал названия складов. Задним числом их получить уже нельзя.
-- Для расчётов по истории — view ниже.

-- ---------------------------------------------------------------------------
-- 1. SSOT списка служебных строк. Таблицей, а не константой в коде: список читают
--    и Edge Function на приёме, и view поверх истории — расходиться им нельзя.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wb_stock_service_rows (
  warehouse_name TEXT PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('total', 'in_transit_to_client',
                                               'in_transit_from_client', 'aggregate')),
  note           TEXT
);

COMMENT ON TABLE public.wb_stock_service_rows IS
  'Служебные строки отчёта WB warehouse_remains, которые нельзя считать складами. SSOT для fetch-wb-stocks и view по истории.';
COMMENT ON COLUMN public.wb_stock_service_rows.kind IS
  'total — итог по складам (дублирует их сумму); in_transit_* — товар в пути; aggregate — свёртка «прочих» складов.';

INSERT INTO public.wb_stock_service_rows (warehouse_name, kind, note) VALUES
  ('Всего находится на складах',  'total',                  'Сумма всех складов. Сложение с ними удваивает остаток.'),
  ('В пути до получателей',       'in_transit_to_client',   'Товар едет покупателю. Не склад.'),
  ('В пути возвраты на склад WB', 'in_transit_from_client', 'Возврат едет на склад. Не склад.'),
  ('Остальные склады',            'aggregate',              'Свёртка мелких складов. Встречалась 29–30.05.2026.'),
  ('Остальные',                   'aggregate',              'То же, другое написание. Встречалась 30.05–05.06.2026.')
ON CONFLICT (warehouse_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Товар в пути — отдельной таблицей, по одной строке на баркод.
--    Не полем на строке склада: тогда одно и то же число размножится по складам,
--    и потребители, которые его суммируют, получат ту же ошибку кратности.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wb_stocks_in_transit (
  barcode     TEXT PRIMARY KEY,
  nm_id       BIGINT,
  to_client   INTEGER NOT NULL DEFAULT 0,
  from_client INTEGER NOT NULL DEFAULT 0,
  fetched_at  TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE public.wb_stocks_in_transit IS
  'Товар в пути на последний прогон fetch-wb-stocks. Одна строка на баркод — складам не принадлежит.';

CREATE INDEX IF NOT EXISTS wb_stocks_in_transit_nm_idx
  ON public.wb_stocks_in_transit (nm_id);

ALTER TABLE public.wb_stock_service_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wb_stocks_in_transit  ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. История: не трогаем, считаем поверх.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_wb_stocks_history_clean
WITH (security_invoker = on) AS
SELECT h.*
FROM public.wb_stocks_history h
WHERE NOT EXISTS (
  SELECT 1 FROM public.wb_stock_service_rows s
  WHERE s.warehouse_name = h.warehouse_name
);

COMMENT ON VIEW public.v_wb_stocks_history_clean IS
  'wb_stocks_history без служебных строк. Считать историю остатков только отсюда, сама таблица — первоисточник, её не чистим.';

CREATE OR REPLACE VIEW public.v_wb_stocks_history_in_transit
WITH (security_invoker = on) AS
SELECT
  h.snapshot_date,
  h.barcode,
  h.nm_id,
  sum(h.quantity) FILTER (WHERE s.kind = 'in_transit_to_client')   AS to_client,
  sum(h.quantity) FILTER (WHERE s.kind = 'in_transit_from_client') AS from_client
FROM public.wb_stocks_history h
JOIN public.wb_stock_service_rows s ON s.warehouse_name = h.warehouse_name
WHERE s.kind IN ('in_transit_to_client', 'in_transit_from_client')
GROUP BY h.snapshot_date, h.barcode, h.nm_id;

COMMENT ON VIEW public.v_wb_stocks_history_in_transit IS
  'Товар в пути по дням, вытащенный из служебных строк истории.';

-- ---------------------------------------------------------------------------
-- 4. Разовая чистка wb_stocks. Порядок важен: сначала спасаем товар в пути
--    в новую таблицу, потом удаляем служебные строки, потом протухшие.
-- ---------------------------------------------------------------------------
INSERT INTO public.wb_stocks_in_transit (barcode, nm_id, to_client, from_client, fetched_at)
SELECT
  st.barcode,
  max(st.nm_id),
  coalesce(sum(st.quantity) FILTER (WHERE s.kind = 'in_transit_to_client'), 0),
  coalesce(sum(st.quantity) FILTER (WHERE s.kind = 'in_transit_from_client'), 0),
  max(st.fetched_at)
FROM public.wb_stocks st
JOIN public.wb_stock_service_rows s ON s.warehouse_name = st.warehouse_name
WHERE s.kind IN ('in_transit_to_client', 'in_transit_from_client')
  AND st.fetched_at = (SELECT max(fetched_at) FROM public.wb_stocks)
GROUP BY st.barcode
ON CONFLICT (barcode) DO UPDATE SET
  nm_id       = EXCLUDED.nm_id,
  to_client   = EXCLUDED.to_client,
  from_client = EXCLUDED.from_client,
  fetched_at  = EXCLUDED.fetched_at;

DELETE FROM public.wb_stocks st
USING public.wb_stock_service_rows s
WHERE s.warehouse_name = st.warehouse_name;

-- Протухшие строки: всё, что не из последнего прогона. Отчёт WB приходит целиком,
-- поэтому склад, отсутствующий в свежем прогоне, остатка не имеет.
DELETE FROM public.wb_stocks
WHERE fetched_at < (SELECT max(fetched_at) FROM public.wb_stocks);

COMMENT ON TABLE public.wb_stocks IS
  'Текущий остаток по настоящим складам на последний прогон fetch-wb-stocks. Инвариант: только строки последнего прогона, без служебных строк (см. wb_stock_service_rows). Товар в пути — в wb_stocks_in_transit. История — wb_stocks_history.';
