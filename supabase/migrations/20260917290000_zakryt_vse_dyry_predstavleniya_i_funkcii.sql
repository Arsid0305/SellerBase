-- Закрыть остальные дыры. Разрешение владелицы 17.09.2026: «закрывай все дыры».
--
-- Что проверено перед правкой:
--   · таблицы - все до одной под RLS без политик, публичный ключ по ним
--     получает пустоту. Тут всё правильно, не трогаем.
--   · функции get_* - работают правами спрашивающего, значит под RLS и
--     публичному ключу отдают пустоту. Не дыра.
--   · функции, которые пишут (calculate_cogs_for_shipment, try_job_lock и
--     прочие) - тоже правами спрашивающего, запись упирается в RLS.
--
-- Настоящие дыры оказались две:
--   1. девять представлений читают данные правами своего создателя, минуя
--      RLS. Через них публичным ключом были доступны логистика по складам,
--      средняя себестоимость, деньги Ozon по товарам, история остатков ВБ
--      и тарифы. Три таких уже закрыты миграцией 20260917280000.
--   2. note_card_upload работает от имени создателя и вызывается публичным
--      ключом через /rest/v1/rpc. Это функция триггера, снаружи её звать
--      незачем.
--
-- Программа не ломается: все эти представления читает только серверная
-- часть служебным ключом, а он правами не ограничен. Проверено по коду -
-- ни одного обращения из браузера.
--
-- Проверено после применения: публичный ключ получает 401 «permission
-- denied», вызов функции - 404. Служебным ключом читаются все двенадцать
-- представлений, счёт строк на месте.

-- 1. Представления - на права спрашивающего, и закрыть от публичного ключа
alter view public.v_ozon_stock_by_sku                 set (security_invoker = on);
alter view public.v_logistics_actual_60d              set (security_invoker = on);
alter view public.v_logistics_actual_60d_by_warehouse set (security_invoker = on);
alter view public.v_sku_avg_costs_60d                 set (security_invoker = on);
alter view public.v_ozon_money_by_sku                 set (security_invoker = on);
alter view public.v_extra_tariffs_current             set (security_invoker = on);
alter view public.v_wb_stocks_history_clean           set (security_invoker = on);
alter view public.v_ozon_expenses_by_month            set (security_invoker = on);
alter view public.v_ozon_services_neznakomye          set (security_invoker = on);

revoke select on public.v_ozon_stock_by_sku                 from anon;
revoke select on public.v_logistics_actual_60d              from anon;
revoke select on public.v_logistics_actual_60d_by_warehouse from anon;
revoke select on public.v_sku_avg_costs_60d                 from anon;
revoke select on public.v_ozon_money_by_sku                 from anon;
revoke select on public.v_extra_tariffs_current             from anon;
revoke select on public.v_wb_stocks_history_clean           from anon;
revoke select on public.v_ozon_expenses_by_month            from anon;
revoke select on public.v_ozon_services_neznakomye          from anon;

-- Права на запись в представление бессмысленны, но выданы по умолчанию.
revoke insert, update, delete, truncate on public.v_ozon_stock_by_sku                 from anon, authenticated;
revoke insert, update, delete, truncate on public.v_logistics_actual_60d              from anon, authenticated;
revoke insert, update, delete, truncate on public.v_logistics_actual_60d_by_warehouse from anon, authenticated;
revoke insert, update, delete, truncate on public.v_sku_avg_costs_60d                 from anon, authenticated;
revoke insert, update, delete, truncate on public.v_ozon_money_by_sku                 from anon, authenticated;
revoke insert, update, delete, truncate on public.v_extra_tariffs_current             from anon, authenticated;
revoke insert, update, delete, truncate on public.v_wb_stocks_history_clean           from anon, authenticated;
revoke insert, update, delete, truncate on public.v_ozon_expenses_by_month            from anon, authenticated;
revoke insert, update, delete, truncate on public.v_ozon_services_neznakomye          from anon, authenticated;

-- 2. Функция триггера снаружи вызываться не должна
revoke execute on function public.note_card_upload() from public, anon, authenticated;

-- 3. Мелкое укрепление: у двух функций не закреплён search_path.
-- Само по себе это не дыра, но при подмене пути функция может позвать
-- чужую подделку вместо нужной таблицы. Закрепляем.
alter function public.ozon_service_group(text) set search_path = public, pg_catalog;
alter function public.canon_charcs(jsonb)      set search_path = public, pg_catalog;
