# Tasks — SellerBase

## [2026-05-28 — актуально]

**Текущий этап:** Phase 1 — Bootstrap + первая миграция.

**Сделано:**
- [x] Структура репо из TEMPLATE (CLAUDE.md, SYSTEM.md, SECURITY.md)
- [x] CI workflows (automerge, deploy)
- [x] Миграция `0001_initial_schema.sql` (sku_catalog, wb_reports_fact_raw, wb_reports_fact, wb_stocks, wb_stocks_history, app_settings, ingestion_log)
- [x] Seed `app_settings` (tax_rate, safety_stock_days, sales_velocity_window, china_lead_time_days, target_margin, cogs_allocation_method)
- [x] План разработки в `docs/PLAN.md`

**Следующий приоритет (Phase 2):**
- [ ] Создать Supabase проект и применить миграцию
- [ ] Завести `WB_API_TOKEN` в GitHub Secrets
- [ ] Написать первый Edge Function `fetch-wb-stocks` (UPSERT в `wb_stocks` + `wb_stocks_history`, лог в `ingestion_log`)
- [ ] Настроить pg_cron на ежедневный вызов
- [ ] Загрузить 2-3 тестовых SKU в `sku_catalog`

**Контекст:**
- Все таблицы создаются с RLS off на старте — включаем когда добавим auth (Phase 5).
- Уникальные ключи для UPSERT: см. комментарии в `0001_initial_schema.sql`.
- WB API endpoint: `/api/v1/supplier/stocks` (base: `https://statistics-api.wildberries.ru`).
