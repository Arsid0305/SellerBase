# fetch-wb-content

Синхронизация карточек товаров с WB Content API в таблицу `sku_catalog`.

## Что делает

Постранично (cursor, 100 шт/стр) запрашивает `POST /content/v2/get/cards/list` и для каждой карточки обновляет строку в `sku_catalog` по совпадению `wb_article = nmID`:

- `title` ← `card.title`
- `brand` ← `card.brand`
- `category` ← `card.subjectName`
- `photo_url` ← `card.photos[0].big` (fallback: c516x688 → c246x328 → tm → square)
- `last_content_sync_at` ← `now()`

`rating` и `reviews_count` через Content API не приходят (нужен Feedbacks API) — остаются NULL на этом этапе.

## Env (function secrets)

- `WB_TOKEN_READ` — токен WB API с правами на группу «Контент»
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Ручной запуск

```bash
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/fetch-wb-content \
  -d '{}'
```

Ответ:
```json
{ "ok": true, "totalCards": 1234, "totalUpdated": 1100, "pages": 13 }
```

## Cron

Запуск ежедневно в 00:00 UTC (03:00 МСК) — см. `supabase/cron/fetch-wb-content.sql`.

## Логи

Supabase Dashboard → Functions → fetch-wb-content → Logs.
История запусков — таблица `ingestion_log` (`job_name = 'fetch-wb-content'`).
