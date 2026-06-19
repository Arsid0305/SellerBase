# Cron-задачи Supabase

Все cron'ы крутятся через `pg_cron` + `pg_net` в Supabase (включены миграцией `0008_enable_pg_net_pg_cron.sql`).
Расписания заданы в SQL через `cron.schedule(...)`. Просмотреть активные: `SELECT * FROM cron.job;`

| Cron job                          | Schedule (UTC)  | МСК     | Edge function              | Что делает                                                                | Миграция                                       |
|-----------------------------------|-----------------|---------|----------------------------|---------------------------------------------------------------------------|------------------------------------------------|
| `fetch-wb-tariffs-daily`          | `0 1 * * *`     | 04:00   | `fetch-wb-tariffs`         | Тарифы коробов WB.                                                        | Dashboard (вне миграций)                       |
| `fetch-wb-goods-returns-daily`    | `0 2 * * *`     | 05:00   | `fetch-wb-goods-returns`   | Обновляет events возвратов за последние 30 дней.                          | `20260613_wb_goods_returns_events.sql`         |
| `fetch-wb-funnel-daily`           | `0 3 * * *`     | 06:00   | `fetch-wb-funnel`          | Воронка заказы→выкуп за вчера.                                            | Dashboard (вне миграций)                       |
| `fetch-wb-report-weekly`          | `0 3 * * 2`     | 06:00 вт | `fetch-wb-report`          | Финансовые отчёты WB Report API за неделю.                                | Dashboard (вне миграций)                       |
| `fetch-wb-funnel-aggregate-daily` | `0 4 * * *`     | 07:00   | `fetch-wb-funnel-aggregate`| Пересчитывает воронку за последние 30 дней (совпадает с окном WB-кабинета). | `20260611_wb_sales_funnel_period.sql`          |
| `fetch-wb-commissions-weekly`     | `0 5 * * 1`     | 08:00 пн | `fetch-wb-commissions`    | Обновляет таблицу комиссий WB раз в неделю.                               | `20260613_margin_polish.sql`                   |
| `fetch-wb-stocks-daily`           | `0 6 * * *`     | 09:00   | `fetch-wb-stocks`          | Текущие остатки на складах WB.                                            | Dashboard (вне миграций)                       |
| `fetch-wb-content-weekly`         | `0 6 * * 2`     | 09:00 вт | `fetch-wb-content`        | Синхронизирует карточки товаров с WB Content API: title, brand, category/subject_name, photo_url, rating, reviews_count, last_content_sync_at. | `20260618_cron_fetch_wb_content.sql`           |
| `telegram-alerts-daily`           | `0 8 * * *`     | 11:00   | `telegram-alerts`          | 5 проверок: маржа, выкуп, дефицит, cron, новые SKU без cost. Шлёт только если есть проблемы. | `20260618_telegram_alerts_cron.sql`            |
| `fetch-wb-sales-30min`            | `*/30 * * * *`  | каждые 30 мин | `fetch-wb-sales`           | Тянет продажи из WB Statistics API `/api/v1/supplier/sales`, UPSERT по `srid`. | `20260614_cron_fetch_wb_sales.sql`             |
| `fetch-wb-orders-30min`           | `*/30 * * * *`  | каждые 30 мин | `fetch-wb-orders`          | Тянет заказы из WB Statistics API `/api/v1/supplier/orders`, UPSERT по `(g_number, date)`. | `20260619120002_cron_fetch_wb_orders.sql`      |

⚠️ Часть cron'ов (`fetch-wb-stocks-daily`, `fetch-wb-tariffs-daily`, `fetch-wb-funnel-daily`, `fetch-wb-report-weekly`) исторически добавлены через Supabase Dashboard, а не миграциями — это технический долг. При воссоздании БД они НЕ восстановятся автоматически. Решение: вынести их в миграции при возможности.

⚠️ Старый ручной cron `fetch-wb-content-daily` (0 0 * * *) удаляется миграцией `20260618_unschedule_old_fetch_wb_content_daily.sql` после применения через CI — заменяется на `fetch-wb-content-weekly`.

---

## Управление

### Посмотреть активные cron'ы
```sql
SELECT jobid, jobname, schedule, command, active FROM cron.job ORDER BY jobname;
```

### Посмотреть последние запуски
```sql
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 50;
```

### Выключить cron временно
```sql
SELECT cron.alter_job(jobid := (SELECT jobid FROM cron.job WHERE jobname = 'fetch-wb-sales-30min'), active := false);
```

### Удалить cron
```sql
SELECT cron.unschedule('fetch-wb-sales-30min');
```

### Запустить функцию вручную (без cron'a)
```bash
supabase functions invoke fetch-wb-sales --no-verify-jwt
```
Или через curl с `Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY`.

---

## Связанные edge functions без cron'a

Эти функции деплоятся, но не имеют автоматического расписания — вызываются вручную или из UI:

- `fetch-wb-promotions` — акции WB (запускается из `/promo`)
- `sync-sheets` — синхронизация с Google Sheets (на паузе)
- `send-notification` — рассылка уведомлений (используется внутри других функций)
- `telegram-webhook` — приём команд из Telegram-бота

---

## Требуемые секреты в Supabase

Без них edge functions падают с 500. Установить:
```bash
supabase secrets set WB_TOKEN_READ='<единый токен на чтение всех API>'
supabase secrets set TELEGRAM_BOT_TOKEN='<токен бота от @BotFather>'
supabase secrets set TELEGRAM_CHAT_ID='<chat_id владелицы>'
```

Системные (ставятся автоматически): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.

---

## Логирование

Каждый успешный/упавший запуск пишется в `ingestion_log`:
```sql
SELECT job_name, status, started_at, finished_at, rows_in, rows_out, error_text
FROM ingestion_log
ORDER BY started_at DESC
LIMIT 50;
```

Статусы: `running` (запущен, ещё не финализирован), `ok` (успех), `error` (ошибка).
Telegram алерт `cron не работает` ловит ситуации когда последний `status='ok'` старше 24 часов.

---

## Часовые пояса

Cron в Supabase работает в **UTC**. Чтобы перевести в МСК — добавить 3 часа.

`0 8 * * *` UTC = `0 11 * * *` МСК (11:00 утра).

Для миграций используйте UTC явно в комментариях:
```sql
-- Cron daily 04:00 UTC = 07:00 МСК — refresh last 60 days
```
