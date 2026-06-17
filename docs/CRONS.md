# Cron-задачи Supabase

Все cron'ы крутятся через `pg_cron` + `pg_net` в Supabase (включены миграцией `0008_enable_pg_net_pg_cron.sql`).
Расписания заданы в SQL через `cron.schedule(...)`. Просмотреть активные: `SELECT * FROM cron.job;`

| Cron job                          | Schedule (UTC)  | МСК     | Edge function              | Что делает                                                                | Миграция                                       |
|-----------------------------------|-----------------|---------|----------------------------|---------------------------------------------------------------------------|------------------------------------------------|
| `fetch-wb-sales-30min`            | `*/30 * * * *`  | каждые 30 мин | `fetch-wb-sales`           | Тянет продажи из WB Statistics API `/api/v1/supplier/sales`, UPSERT по `srid`. Покрывает «вчера» которое лагает в Report API. | `20260614_cron_fetch_wb_sales.sql`             |
| `fetch-wb-goods-returns-daily`    | `0 2 * * *`     | 05:00   | `fetch-wb-goods-returns`   | Обновляет events возвратов за последние 30 дней.                          | `20260613_wb_goods_returns_events.sql`         |
| `fetch-wb-funnel-aggregate-daily` | `0 4 * * *`     | 07:00   | `fetch-wb-funnel-aggregate`| Пересчитывает воронку (заказы → выкуп) за последние 60 дней.              | `20260611_wb_sales_funnel_period.sql`          |
| `fetch-wb-commissions-weekly`     | `0 5 * * 1`     | 08:00 пн | `fetch-wb-commissions`    | Обновляет таблицу комиссий WB раз в неделю.                               | `20260613_margin_polish.sql`                   |
| `telegram-alerts-daily`           | `0 8 * * *`     | 11:00   | `telegram-alerts`          | 5 проверок: маржа, выкуп, дефицит, cron, новые SKU без cost. Шлёт только если есть проблемы. | `20260618_telegram_alerts_cron.sql`            |

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

- `fetch-wb-report` — финансовые отчёты (запускается из UI кнопкой «Обновить»)
- `fetch-wb-stocks` — остатки на складах (запускается из UI)
- `fetch-wb-funnel` — окно за конкретный период (для бэкфилла)
- `fetch-wb-tariffs` — тарифы (запускается по необходимости)
- `fetch-wb-content` — карточки товаров (запускается при добавлении новых SKU)
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
SELECT job_name, status, started_at, finished_at, rows_processed, error_message
FROM ingestion_log
ORDER BY started_at DESC
LIMIT 50;
```

Telegram алерт `cron не работает` ловит ситуации когда последний `status='success'` старше 24 часов.

---

## Часовые пояса

Cron в Supabase работает в **UTC**. Чтобы перевести в МСК — добавить 3 часа.

`0 8 * * *` UTC = `0 11 * * *` МСК (11:00 утра).

Для миграций используйте UTC явно в комментариях:
```sql
-- Cron daily 04:00 UTC = 07:00 МСК — refresh last 60 days
```
