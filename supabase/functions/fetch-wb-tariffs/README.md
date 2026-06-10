# fetch-wb-tariffs

Ежедневный фетч общих тарифов Wildberries (Common Tariffs API) — Box (FBO) + Return.
Идемпотентен: UPSERT по `(effective_date, warehouse_name)`.

## Env (function secrets)

- `WB_TOKEN_READ` — токен WB API с правами на категорию «Общая информация» (Common API).
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — инжектятся платформой.

## Endpoints

- `GET https://common-api.wildberries.ru/api/v1/tariffs/box?date=YYYY-MM-DD`
- `GET https://common-api.wildberries.ru/api/v1/tariffs/return?date=YYYY-MM-DD`

Header: `Authorization: <WB_TOKEN_READ>`.

## Таблицы

- `wb_tariffs_box` — базовые тарифы по складам, коэф склада, габаритные множители.
- `wb_tariffs_return` — тарифы возврата.

## Cron

Файл `supabase/cron/fetch-wb-tariffs.sql` — расписание `0 1 * * *` (01:00 UTC = 04:00 МСК).
Применяется вручную через Supabase Dashboard / SQL Editor.

## Тест локально

```
curl -X POST \
  "https://<PROJECT>.supabase.co/functions/v1/fetch-wb-tariffs" \
  -H "Authorization: Bearer <SERVICE_ROLE>"
```

Ответ: `{ ok: true, box: N, ret: M, date: "YYYY-MM-DD" }`.

Лог пишется в `ingestion_log` (`job_name = 'fetch-wb-tariffs'`).
