# Cron-задачи Supabase

Все cron'ы крутятся через `pg_cron` + `pg_net` в Supabase (включены миграцией `0008_enable_pg_net_pg_cron.sql`).
Расписания заданы в SQL через `cron.schedule(...)`. Просмотреть активные: `SELECT * FROM cron.job;`

| Cron job | Schedule (UTC) | МСК | Что вызывает | Что делает |
|---|---|---|---|---|
| `fetch-wb-sales-30min` | `*/30 * * * *` | каждые 30 мин | `fetch-wb-sales` | Продажи из Statistics API, UPSERT по `srid` |
| `fetch-wb-orders-30min` | `*/30 * * * *` | каждые 30 мин | `fetch-wb-orders` | Заказы из Statistics API, UPSERT по `(g_number, date)` |
| `detect-anomalies-hourly` | `0 * * * *` | ежечасно | `detect-anomalies` | Ищет аномалии в свежих данных |
| `clean-stale-jobs-hourly` | `17 * * * *` | ежечасно | SQL `clean_stale_running_jobs_all('2 hours')` | Закрывает задания, зависшие в статусе `running` |
| `fetch-wb-tariffs-daily` | `0 1 * * *` | 04:00 | `fetch-wb-tariffs` | Тарифы коробов WB |
| `fetch-wb-promotions-daily` | `30 1 * * *` | 04:30 | `fetch-wb-promotions` | Календарь акций + метрики участия и пороги бустинга |
| `refresh-sku-weekly-metrics-daily` | `0 1 * * *` | 04:00 | SQL `refresh_sku_weekly_metrics(текущий год)` | Пересчёт недельных метрик по SKU |
| `fetch-wb-goods-returns-daily` | `0 2 * * *` | 05:00 | `fetch-wb-goods-returns` | События возвратов за 30 дней |
| `fetch-wb-prices-daily` | `0 2 * * *` | 05:00 | `fetch-wb-prices` | Цены и скидки |
| `fetch-wb-feedback-daily` | `30 2 * * *` | 05:30 | `fetch-wb-feedback` | Отзывы покупателей |
| `fetch-wb-questions-daily` | `40 2 * * *` | 05:40 | `fetch-wb-questions` | Вопросы к карточкам |
| `fetch-wb-funnel-daily` | `0 3 * * *` | 06:00 | `fetch-wb-funnel` | Воронка заказы → выкуп за вчера |
| `fetch-wb-report-weekly` | `0 3 * * 2` | 06:00 вт | `fetch-wb-report` | Финансовый отчёт о реализации за неделю |
| `fetch-wb-funnel-aggregate-daily` | `0 4 * * *` | 07:00 | `fetch-wb-funnel-aggregate` | Пересчёт воронки за 30 дней — окно WB-кабинета |
| `fetch-wb-commissions-weekly` | `0 5 * * 1` | 08:00 пн | `fetch-wb-commissions` | Комиссии WB |
| `fetch-wb-stocks-daily` | `0 6 * * *` | 09:00 | `fetch-wb-stocks` | Остатки на складах |
| `fetch-wb-content-weekly` | `0 6 * * 2` | 09:00 вт | `fetch-wb-content` | Карточки: наименование, категория, фото, рейтинг, отзывы |
| `telegram-indices-reminder-monday` | `0 6 * * 1` | 09:00 пн | `telegram-indices-reminder` | Напоминание по индексам |
| `telegram-alerts-daily` | `0 8 * * *` | 11:00 | `telegram-alerts` | Пять проверок: маржа, выкуп, дефицит, здоровье cron, новые SKU без себестоимости. Молчит, если проблем нет |

### Отключённые задания (`active = false`)

Стоят в `cron.job`, но не запускаются. Не удалены — чтобы вернуть, достаточно `alter_job`.

| Cron job | Schedule | Почему выключен |
|---|---|---|
| `fetch-wb-supplies-daily` | `0 3 * * *` | WB отдаёт **405** на `ag-supplies`: 160 ошибок в `ingestion_log`, последняя 21.08.2026. Метод API изменился |
| `fetch-wb-supplies-6h` | `17 */6 * * *` | То же, дубль расписания того же задания |
| `fetch-wb-ads-hourly` | `15 * * * *` | 758 ошибок, все — «зависла в статусе `running`, закрыта уборщиком». Последняя 21.08.2026 |

**Таблица выше собрана из `cron.job` 04.09.2026.** Раньше здесь было 13 заданий
из 21 — недоставало обоих SQL-заданий, цен, отзывов, вопросов, аномалий,
напоминания по индексам и всех трёх отключённых.

### Акции — включено 04.09.2026

`fetch-wb-promotions-daily`, `30 1 * * *` (04:30 МСК) — восстановлен и работает.
До этого задания в `cron.job` не было, а `wb_promotions` не обновлялась с 12.06.2026.

Функция переписана в тот же день: состав участников для авто-акций WB закрыл
(422 при любом `inAction`), вместо него тянутся агрегаты из `/details` — сколько
наших товаров участвует, сколько нет, процент участия и пороги бустинга.
Смотреть в `v_wb_promotions_boost`.

⚠️ **Прежнее замечание про Dashboard снято.** Раньше здесь стояло, что четыре задания
(`fetch-wb-stocks-daily`, `fetch-wb-tariffs-daily`, `fetch-wb-funnel-daily`,
`fetch-wb-report-weekly`) заведены руками и при воссоздании БД не восстановятся.
На 04.09.2026 все 21 задание имеют файл миграции с `cron.schedule` —
`20260620200001_cron_x_cron_secret.sql` пересоздал их скопом.

⚠️ **Сверять состав заданий по именам файлов миграций нельзя.** Миграции применяются
через MCP `apply_migration`, который присваивает свою метку времени — в
`supabase_migrations.schema_migrations` 164 версии на 128 файлов в репозитории,
и имена не совпадают. Единственная надёжная проверка — `SELECT * FROM cron.job`.

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
SELECT cron.alter_job(job_id := (SELECT jobid FROM cron.job WHERE jobname = 'fetch-wb-sales-30min'), active := false);
```

### Удалить cron
```sql
SELECT cron.unschedule('fetch-wb-sales-30min');
```

### Запустить функцию вручную (без cron'a)

**Supabase CLI в проекте нет** — запуск тем же способом, что и cron, из SQL.
Секреты берутся из Vault, знать их не нужно. Готовый запрос — в `CLAUDE.md`,
раздел «Деплой и запуск Edge Functions».

Результат смотреть в `public.ingestion_log`, **не** в `cron.job_run_details`:
pg_cron считает успехом постановку запроса, а не ответ функции.

---

## Связанные edge functions без cron'a

Эти функции деплоятся, но не имеют автоматического расписания — вызываются вручную или из UI:

- `fetch-wb-promotions` — акции WB (запускается из `/promo`)
- `sync-sheets` — синхронизация с Google Sheets (на паузе)
- `send-notification` — рассылка уведомлений (используется внутри других функций)
- `telegram-webhook` — приём команд из Telegram-бота

---

## Требуемые секреты в Supabase

### Edge Function Secrets (Deno.env)

Без них edge functions падают с 500. Установить:
```bash
supabase secrets set WB_TOKEN_READ='<единый токен на чтение всех API>'
supabase secrets set TELEGRAM_BOT_TOKEN='<токен бота от @BotFather>'
supabase secrets set TELEGRAM_CHAT_ID='<chat_id владелицы>'
supabase secrets set CRON_SHARED_SECRET='<long-random-hex>'  # сравнение X-Cron-Secret в _shared/auth.ts
```

Системные (ставятся автоматически): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.

### Supabase Vault (для pg_cron → net.http_post)

`ALTER DATABASE postgres SET app.settings.*` в Supabase **недоступен** (нужен superuser).
Все секреты для cron'ов хранятся в Vault и читаются через
`(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = '...')`.

| Имя в Vault          | Что это                                            | Кто использует                         |
|----------------------|----------------------------------------------------|----------------------------------------|
| `cron_shared_secret` | Тот же hex что `CRON_SHARED_SECRET` в Edge Secrets | Заголовок `X-Cron-Secret` в cron jobs  |
| `service_role_key`   | Полный service_role JWT (Settings → API)           | Заголовок `Authorization: Bearer ...` для `verify_jwt=true` |

Добавить (Supabase Dashboard → SQL Editor):
```sql
SELECT vault.create_secret('<long-random-hex>',         'cron_shared_secret');
SELECT vault.create_secret('<service_role JWT>',        'service_role_key');
```

Ротация service_role JWT (обновляется в Dashboard → Settings → API → Reset):
```sql
-- Обновить значение в Vault после ротации
UPDATE vault.secrets SET secret = vault.encrypted_secret('<новый JWT>')
WHERE name = 'service_role_key';
-- Проще: Dashboard → Project Settings → Vault → edit
```
Если не обновить — все cron'ы начнут падать с 401 (verify_jwt отвергнет старый JWT).

---

## CRON_SHARED_SECRET — защита cron edge functions

Все cron-функции имеют `verify_jwt = false` (pg_cron не умеет генерить service_role JWT).
Чтобы внешние пользователи не могли вызвать их напрямую, добавлен заголовок `X-Cron-Secret`
(см. `supabase/functions/_shared/auth.ts`, helper `checkCronSecret`).

Логика:
- Если `Deno.env.CRON_SHARED_SECRET` не задан → функция пропускает любой запрос
  (обратная совместимость).
- Если задан и `X-Cron-Secret` header совпадает → пропускает.
- Иначе → `401 unauthorized`.

pg_cron шлёт header через `current_setting('app.settings.cron_shared_secret', true)`
(см. миграцию `20260620200001_cron_x_cron_secret.sql`). Если setting не задан — пустая
строка, секрет в env тоже не задан → всё работает по-старому.

### Активация защиты (после мерджа PR)

1. Сгенерировать случайную строку (≥32 символа):
   ```bash
   openssl rand -hex 32
   ```
2. Положить в env edge functions:
   ```bash
   supabase secrets set CRON_SHARED_SECRET='<сгенерированная строка>'
   ```
3. Положить в БД (тот же самый секрет):
   ```sql
   ALTER DATABASE postgres SET app.settings.cron_shared_secret = '<сгенерированная строка>';
   SELECT pg_reload_conf();
   ```
4. Проверить: внешний `curl https://<project>.supabase.co/functions/v1/telegram-alerts`
   без header → 401. С `-H 'X-Cron-Secret: <secret>'` → 200.

Покрыты: `telegram-alerts`, `detect-anomalies`, `fetch-wb-content`, `fetch-wb-funnel`,
`fetch-wb-funnel-aggregate`, `fetch-wb-commissions`, `fetch-wb-goods-returns`,
`fetch-wb-tariffs`, `fetch-wb-stocks`, `fetch-wb-report`,
`fetch-wb-sales`, `fetch-wb-orders`, `fetch-wb-ads`.

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

---

## Отключено вручную 2026-08-21

Чтобы не дёргать WB API впустую. Отключение обратимое — задачи на месте, `active = false`.

| Cron job | Почему отключён |
|---|---|
| `fetch-wb-ads-hourly` | рекламных кампаний нет; 167 запусков зависли в статусе `running` |
| `fetch-wb-supplies-6h` | эндпоинт WB отвечал 404, после деплоя v2 — 405 |
| `fetch-wb-supplies-daily` | дубль предыдущей: поставки дёргали **две** задачи одновременно |

Включить обратно:
```sql
SELECT cron.alter_job(job_id := jobid, active := true)
FROM cron.job WHERE jobname = '<имя>';
```

## Не описано выше, но работает в проде

Найдено сверкой 2026-08-21. Всего в базе 19 задач, в таблице выше — 12.

`fetch-wb-feedback-daily`, `fetch-wb-prices-daily`, `fetch-wb-supplies-6h`,
`detect-anomalies-hourly`, `fetch-wb-ads-hourly`, `telegram-indices-reminder-monday`,
`refresh-sku-weekly-metrics-daily`.

**Важно:** `cron.job_run_details.status = succeeded` не означает, что функция отработала.
pg_cron считает успехом постановку HTTP-запроса в очередь. Достоверный источник —
`public.ingestion_log`.
