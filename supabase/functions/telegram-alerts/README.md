# telegram-alerts

Ежедневная проверка ключевых метрик SellerBase и алерт владелице в Telegram, если что-то сломалось.
Запускается кроном раз в день в 11:00 МСК (08:00 UTC) — см. `supabase/migrations/20260618_telegram_alerts_cron.sql`.

## Проверки

1. Маржа упала >5 п.п. за последние 7д vs предыдущие 7д
2. Выкуп упал >10 п.п. за последние 7д vs предыдущие 7д
3. SKU в дефиците — daysOfStock < 7 среди топ-20 SKU по выручке
4. Cron не работает — нет успешного запуска >24ч для любого job из `ingestion_log`
5. Новые SKU без себестоимости — добавлены за последние 7д, `cost_price_rub IS NULL/0`

Если все 5 проверок зелёные — сообщение не отправляется (чтобы не спамить «всё ок»).

## Env vars

| Переменная | Назначение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | токен бота от BotFather |
| `TELEGRAM_CHAT_ID` | chat_id владелицы, куда слать алерты |
| `SUPABASE_URL` | задаётся автоматически Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | задаётся автоматически Supabase |

## Как создать бота

1. Написать [@BotFather](https://t.me/BotFather) в Telegram → `/newbot` → следовать инструкциям → получить токен.

## Как получить chat_id

1. Написать своему боту любое сообщение (например `/start`).
2. Выполнить:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
   ```
3. В ответе найти `message.chat.id` — это и есть `chat_id`.

## Как задать секреты в Supabase

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=xxxxx
supabase secrets set TELEGRAM_CHAT_ID=xxxxx
```

(используется `SBP_ACCESS_TOKEN` для авторизации CLI, если локально не залогинен).

## Расписание

Раз в день, 11:00 МСК (08:00 UTC), через `pg_cron` + `pg_net` (см. миграцию `20260618_telegram_alerts_cron.sql`).
