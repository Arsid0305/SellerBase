# Сверка репозитория с продом — 2026-08-21

> **Скоуп:** расхождения между кодом в `main` и фактическим состоянием проекта
> `hcebwgjgppwaguqittpi`. Не полный аудит по `AUDIT_PROMPT.md` — узкая сверка.
> **Метод:** запросы к проду (`information_schema`, `cron.job`, `supabase_migrations`,
> `pg_proc`) + разбор кода миграций и Edge Functions.
> **Правила:** только диагноз, без правок. Решение за владелицей.

---

## Итог одной строкой

Схема базы почти целиком соответствует репозиторию — не хватает одной таблицы.
Расходятся **функции**: пять не задеплоены, одна работает в устаревшей версии.
Механизм защиты от зомби-задач построен и не подключён ни в одной функции.

---

## 1. Схема базы — 🟢 почти чисто

Из 79 таблиц и view, создаваемых миграциями, в проде отсутствует **одна**.

| Объект | Миграция | Факт |
|---|---|---|
| `wb_goods_returns_events` | `20260613_wb_goods_returns_events.sql` | таблицы нет |

**Следствие:** `fetch-wb-goods-returns` (`index.ts:164`) пишет именно в неё и падает
ежедневно с `Could not find the table 'public.wb_goods_returns_events' in the schema cache`.
Возвраты не собираются ни дня. При этом cron `fetch-wb-goods-returns-daily` активен —
то есть часть той же миграции (регистрация расписания) применилась, а `CREATE TABLE` нет.

Отдельно: сверка по именам миграций невозможна. В `supabase_migrations.schema_migrations`
имя задаётся вручную при `apply_migration` и с именем файла не совпадает
(`20260605_backfill_snapshots.sql` → `backfill_snapshots_30d`). Единственный надёжный
способ — сверять создаваемые объекты, как сделано здесь.

## 2. Edge Functions — 🔴 главное расхождение

В репозитории 24 функции, в проде 19, в `config.toml` объявлено 17.

**Не задеплоены (5):**

| Функция | Изменена | Вызывается cron'ом |
|---|---|---|
| `fetch-wb-feedback` | 06.07 | да, `fetch-wb-feedback-daily` 02:30 |
| `fetch-wb-prices` | 06.07 | да, `fetch-wb-prices-daily` 02:00 |
| `telegram-indices-reminder` | 06.07 | да, `telegram-indices-reminder-monday` |
| `create-wb-supply` | 11.07 | нет |
| `set-wb-price` | 06.07 | нет |

Три из них дёргаются расписанием впустую. Отсюда пустые `wb_reviews_fact`
и `wb_prices_fact` при формально «успешных» записях в `cron.job_run_details`:
pg_cron считает успехом постановку HTTP-запроса, а не его результат.

**Работает устаревшая версия (1):**

`fetch-wb-supplies` — в проде версия, обращающаяся к `/api/v1/supplier/incomes`
(statistics-api), в репозитории с 11.07 лежит v2 под `supplies-api.wildberries.ru/api/v1/supplies`
(`index.ts:2,12,54`). Признак: в логе ошибка `WB incomes 404` и `meta.lookback_days: 90` —
ни слова «incomes», ни `lookback_days` в новом коде нет.

**Причина общая.** С 01.07 менялись восемь функций. Задеплоена одна — `fetch-wb-content`,
20.08, вручную (видно по `entrypoint_path`: `/tmp/user_fn_...` вместо `/home/runner/work/...`
у остальных). 11.07 GitHub отключил Actions после срабатывания anti-abuse — деплой встал
в тот же день, когда была смержена v2 поставок.

**Не объявлены в `config.toml` (7):** `create-wb-supply`, `fetch-wb-feedback`,
`fetch-wb-prices`, `fetch-wb-supplies`, `fetch-wb-turnover`, `set-wb-price`,
`telegram-indices-reminder`. Из них две задеплоены (`fetch-wb-supplies`, `fetch-wb-turnover`) —
то есть работают без записи в конфиге.

## 3. Защита от зомби-задач — 🔴 построена и не подключена

`AUDIT_PROMPT.md` требует: «`pg_advisory_lock` на входе каждой ingestion-функции —
иначе зомби `running` записи».

В базе механизм есть, миграция `job_advisory_locks` применена 20.06:

- `try_job_lock(p_job_name text)`
- `release_job_lock(p_job_name text)`
- `clean_stale_running_jobs(p_job_name text, p_max_age interval default '1 hour')`

**Ни одна из 24 функций их не вызывает.** Поиск по `advisory`, `try_job_lock`,
`release_job_lock` в `supabase/functions/` не даёт ни одного совпадения.

**Следствие:** `fetch-wb-ads` — 167 записей в `ingestion_log` со статусом `running`
за 7 дней, ни одной завершённой. Функция стартует, пишет себя в лог и не закрывает запись.
Рекламы у магазина нет, поэтому данные не пострадали, но механика та же у всех остальных.

## 4. `X-Cron-Secret` guard — 🟠 отсутствует у 10 функций

Канон: guard обязателен в функциях, запускаемых по расписанию.

Нет в: `create-wb-supply`, `fetch-wb-ads`, `fetch-wb-orders`, `fetch-wb-promotions`,
`fetch-wb-sales`, `fetch-wb-turnover`, `send-notification`, `set-wb-price`, `sync-sheets`,
`telegram-webhook`.

Из них по cron запускаются `fetch-wb-ads`, `fetch-wb-orders`, `fetch-wb-sales` —
последние две каждые 30 минут. `telegram-webhook` в списке ожидаемо: у него
`verify_jwt = false` по назначению.

## 5. `verify_jwt` — 🟢 соответствует канону

`verify_jwt = false` установлен ровно у одной функции — `telegram-webhook`, как и требует
`AUDIT_PROMPT.md`. У остальных объявленных — `true`.

## 6. Cron — 🟠 расписание живёт своей жизнью

19 задач в базе, 12 описано в `docs/CRONS.md`.

Не описаны: `fetch-wb-feedback-daily`, `fetch-wb-prices-daily`, `fetch-wb-supplies-6h`,
`detect-anomalies-hourly`, `fetch-wb-ads-hourly`, `telegram-indices-reminder-monday`,
`refresh-sku-weekly-metrics-daily`.

Поставки дёргают **две** задачи одновременно: `fetch-wb-supplies-6h` и
`fetch-wb-supplies-daily`. Обе бьют в один и тот же снятый эндпоинт.

В разделе «Управление» команда отключения записана как `cron.alter_job(jobid := ...)`.
Правильный параметр — `job_id`. Команда из документации не выполняется.

**Отключено 21.08** по просьбе владелицы, чтобы не дёргать WB API впустую:
`fetch-wb-ads-hourly`, `fetch-wb-supplies-6h`, `fetch-wb-supplies-daily`.
В `CRONS.md` это не отражено.

## 7. RLS — 🟠 семь таблиц открыты

`manual_expenses`, `wb_prices_fact`, `wb_reviews_fact`, `wb_personal_indices`,
`wb_supplies_v2`, `wb_supply_items_v2`, `delivery_to_wb_invoices`.

Читаются и пишутся по anon-ключу. Сейчас пусты, но `wb_prices_fact` и `manual_expenses`
предназначены для цен и расходов. Включение RLS без политик заблокирует доступ полностью —
делать вместе с политиками под `service_role`, как у соседних таблиц.

---

## Что из этого чинится дёшево

Не рекомендация к действию, а оценка трудоёмкости.

| Находка | Что нужно |
|---|---|
| Возвраты не собираются | применить `CREATE TABLE` из существующей миграции |
| Поставки 404 | задеплоить v2, которая уже написана |
| Отзывы и цены пусты | задеплоить две функции |
| `CRONS.md` разошёлся | правка документа |
| `config.toml` неполон | добавить 7 секций |
| Зомби `running` | вызвать существующие `try_job_lock` / `release_job_lock` в функциях |
| RLS | политики + включение, требует решения по модели доступа |

Оборачиваемость (`fetch-wb-turnover`, 404 с 11.06) в этот список не входит: там
изменился внешний API, нужен разбор актуального эндпоинта WB.
