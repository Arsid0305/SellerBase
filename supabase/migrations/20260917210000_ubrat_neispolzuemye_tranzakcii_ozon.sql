-- Убираем таблицу ozon_transactions: она заведена под метод, которого больше нет.
--
-- 17.09.2026 я завела её под v3/finance/transaction/list, а Ozon этот метод
-- погасил - отвечает «obsolete method cannot be used». Живой источник денег
-- оказался другой: v2/finance/realization, под него заведена ozon_realization.
--
-- Таблица не успела получить ни строки. Пустых заготовок «на будущее» в базе
-- не держим (tasks/rules.md §32): если метод вернётся, заведём заново.

drop table if exists public.ozon_transactions;
