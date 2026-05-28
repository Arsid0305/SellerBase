# Tasks — SellerBase

## [2026-05-28 — актуально]

**Текущий этап:** Phase 2 — сбор данных из WB API.

### Supabase проект ✅
- **Name:** SellerBase
- **Project ref:** `hcebwgjgppwaguqittpi`
- **URL:** https://hcebwgjgppwaguqittpi.supabase.co
- **Region:** eu-central-1 (Frankfurt)
- **Публичный ключ:** `sb_publishable_dmr1CASfRZR5jJDUOgLZuA_rKJ1uHHb` (для фронта)

### Phase 1 — сделано ✅
- [x] Bootstrap репо из TEMPLATE
- [x] Миграция `0001_initial_schema.sql` применена
- [x] Seed `app_settings` (7 ключей)
- [x] Миграция `0002_enable_rls.sql` — RLS включён на всех 7 таблицах
- [x] CI fix: automerge реагирует на `ready_for_review`

### Следующий приоритет (Phase 2)
- [ ] Завести `WB_API_TOKEN` в Supabase Edge Function secrets (не в GitHub Secrets, там только `SBP_ACCESS_TOKEN` и `SUPABASE_PROJECT_REF` для деплоя)
- [ ] Написать `supabase/functions/fetch-wb-stocks` (Deno/TS):
  - GET `https://statistics-api.wildberries.ru/api/v1/supplier/stocks?dateFrom=...`
  - UPSERT в `wb_stocks` по `(barcode, warehouse_name)`
  - INSERT в `wb_stocks_history` по `(snapshot_date, barcode, warehouse_name)`
  - Строка в `ingestion_log` на каждый запуск
- [ ] Настроить `pg_cron` на ежедневный вызов
- [ ] Добавить 2-3 тестовых SKU в `sku_catalog` (из твоего Excel-файла)

### Контекст
- RLS включён, политик нет — доступ только через service_role (в Edge Functions и MCP). Политики добавим когда будет auth.
- WB API base: `https://statistics-api.wildberries.ru`, `https://common-api.wildberries.ru/api/v1/tariffs/...`.
- Для Edge Functions используем `SUPABASE_SERVICE_ROLE_KEY` из `Deno.env.get(...)` — в Edge Functions он доступен автоматически.
