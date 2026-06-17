# fetch-wb-content

Синхронизация карточек товаров с WB Content API в таблицу `sku_catalog`.

## Что делает

Постранично (cursor, 100 шт/стр) запрашивает `POST /content/v2/get/cards/list` (WB Content API, `https://content-api.wildberries.ru`) и для каждой карточки обновляет строку в `sku_catalog` по совпадению `wb_article = nmID`:

- `title` ← `card.title`
- `brand` ← `card.brand`
- `category` ← `card.subjectName` (legacy-поле, оставлено для обратной совместимости)
- `subject_name` ← `card.subjectName`
- `rating` ← `card.rating`, если присутствует в ответе
- `reviews_count` ← `card.reviewsCount`, если присутствует в ответе
- `photo_url` ← `card.photos[0].big` (fallback: c516x688 → c246x328 → tm → square)
- `last_content_sync_at` ← `now()`

`rating` и `reviews_count` через `/content/v2/get/cards/list` обычно не приходят (нужен отдельный Feedbacks API) — на практике остаются NULL, но код готов их подхватить если WB начнёт отдавать эти поля.

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

- Еженедельно, вторник 06:00 UTC (09:00 МСК) — `fetch-wb-content-weekly`, см. `supabase/migrations/20260618_cron_fetch_wb_content.sql`.
- Старый вариант (ежедневно, 00:00 UTC) описан в `supabase/cron/fetch-wb-content.sql` — применялся вручную через Dashboard, не через миграции.

## Логи

Supabase Dashboard → Functions → fetch-wb-content → Logs.
История запусков — таблица `ingestion_log` (`job_name = 'fetch-wb-content'`).
