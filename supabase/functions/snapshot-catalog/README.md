# snapshot-catalog

Edge Function: ежедневный снимок каталога SKU в таблицу `sku_snapshots`.

## Что делает

1. Читает все строки из `sku_catalog` (до 10 000).
2. Считает среднюю `retail_price` из `wb_reports_fact` за последние 7 дней по `nm_id`.
3. UPSERT в `sku_snapshots` чанками по 500, по UNIQUE(`sku_id`, `snapshot_date`).
4. Возвращает JSON со счётчиками.

Поля `rating` и `reviews_count` пока `null` — источника нет (TODO: WB Content API).

## Ответ

```json
{
  "ok": true,
  "snapshot_date": "2026-06-04",
  "count": 1234,
  "total": 1234,
  "with_price": 987
}
```

## Переменные окружения

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Обе проставляются Supabase автоматически.

## Деплой

Через GitHub Actions (`.github/workflows/deploy.yml`) — `supabase functions deploy` без указания
имени деплоит всё в `supabase/functions/`. Триггерится push в `main` с изменениями в
`supabase/functions/**`.

Локально (если есть CLI):

```bash
supabase functions deploy snapshot-catalog --project-ref <ref>
```

## Расписание

Cron-задача в `supabase/cron/snapshot-catalog.sql`: запускается в 23:00 UTC (02:00 МСК).
Применить вручную через SQL Editor или MCP `apply_migration` (не миграция — выполнить как
обычный SQL после деплоя функции).

## Ручной запуск

```bash
curl -X POST https://<ref>.supabase.co/functions/v1/snapshot-catalog \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```
