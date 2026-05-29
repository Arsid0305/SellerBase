# Session Log — SellerBase

> **Правило:** читать этот файл ПЕРВЫМ в начале каждой новой сессии или после перерыва.
> Самая верхняя запись = последняя сессия, точка возобновления.
> Append-only: новые записи — сверху, старые не удалять.

---

## 2026-05-29 (вечер) — YC миграция + параметрические P&L

**Цель:** обойти WB-блок `/reportDetailByPeriod` от foreign IP, наладить регулярный сбор отчёта о реализации, добавить P&L по периоду.

### Проблема, которую решали
Supabase Edge Functions хостятся в eu-central-1 (Frankfurt). WB Statistics API режет `/reportDetailByPeriod` с не-RU IP кодом 429. Stocks работали, отчёт о реализации — нет.

### Решение
Перенесли два фетчера в **Yandex Cloud Functions** (Node.js 18, RU IP).

### Сделано
- YC service-account `sellerbase-deployer` (folder `b1gumjic8uebc4m8aq9g`, roles: `functions.admin`, `iam.serviceAccounts.user`).
- Деплой `fetch-wb-stocks` → `https://functions.yandexcloud.net/d4es6nv2vh64o0v0om7d`.
- Деплой `fetch-wb-report` → `https://functions.yandexcloud.net/d4e4s8o3oqd27qv6gs94`.
  - Поддержка `?from=YYYY-MM-DD&to=YYYY-MM-DD` (явное окно) + `?days=N` (fallback).
  - Пауза 65 сек между страницами пагинации (WB ~1 req/min).
  - Дедуп по `srid` внутри страницы → upsert.
  - WebSocket-полифилл (`globalThis.WebSocket = require('ws')`) для @supabase/supabase-js на Node 18.
- Обе функции `allow-unauthenticated-invoke`, env-vars выставлены.
- `pg_cron` переключён:
  - `fetch-wb-stocks-daily` `0 6 * * *` → YC stocks
  - `fetch-wb-report-weekly` `30 6 * * 1` → YC report (`?days=14`)
  - старый daily-backup удалён.
- Загружены реальные данные:
  - `wb_stocks_history` — 90 строк за 2026-05-29.
  - `wb_reports_fact` — 3165 транзакций за 2026-03-30 → 2026-05-24 (5814 rows_in от WB, дедуп до 3165 уникальных srid).
- Свод за 2026-03-30 → 2026-05-24: revenue 201 724,42 ₽, net profit 133 091,52 ₽, маржа 65,98 %.

### Миграция 0010_get_pnl_by_period.sql
- `get_pnl_by_period(p_from, p_to)` — P&L по SKU за окно.
- `get_pnl_totals(p_from, p_to)` — одна строка со сводом.
- Обе `security invoker`, `search_path=''`, ссылки fully-qualified (`public.*`).
- Используются для исторических сверок (UNIT.xlsx).

### Безопасность
- WB-токен и Supabase service_role засветились в чате (попадание в логи). Решено **не ротировать** — управляемый риск (соло-владелец, один ноут). YC service-account key (одноразовый, для деплоя) удалён после первого деплоя, восстановлен для повторного, висит как есть.
- Best practice на будущее: после завершения работы с YC удалить ключ.

### Состояние данных
- `wb_stocks`: 90 строк (сегодняшний снапшот).
- `wb_stocks_history`: 90 строк за 2026-05-29.
- `wb_reports_fact`: 3165, окно 2026-03-30 → 2026-05-24.
- Исторические данные (2024-2025) — следующая задача, тянутся через `?from&to` чанками по кварталам.

### Следующие шаги
1. Дотянуть исторический отчёт о реализации за 2024-01-01 → 2026-03-29 квартальными чанками (пауза 75 сек между запросами, чтобы не упереться в WB rate-limit).
2. Сверить `get_pnl_totals(...)` за конкретные периоды с твоей UNIT.xlsx (сначала декабрь 2025).
3. Если расхождение <1% — Phase 5 (Google Sheets sync + Lovable дашборд).
4. Миграция `0011_marketing_expenses_cash_flow.sql` (ручной ввод финансовых операций).
5. Phase 4 v2: переписать `calculate_cogs_for_shipment` под комплекты (текущая делит сумму на компоненты, для кит-SKU неверно).

### Ограничения сессии
- Sandbox-сеть Claude Code не пускает в console.yandex.cloud и dev.wildberries.ru (403). Деплой делается на ПК пользователя через Git Bash + YC CLI.

### Незакрытые вопросы
- Точная глубина WB-истории неизвестна — выясним при квартальном прогоне 2024.

---

## 2026-05-28 → 2026-05-29 — старт проекта (Phase 1 → Phase 2-5)

**Цель:** с нуля собрать платформу SellerBase — замену Excel-комплекса для управления WB.

### Решения этой сессии
- Стек: **Supabase + Edge Functions + Lovable** (по Gemini-плану, не ChatGPT FastAPI).
- MVP — только WB. Ozon/Telegram/AI → Phase 7.
- Стартовая БД — 3 базовые таблицы + служебные, остальное — отдельными миграциями.
- Google-таблицы **не парсим** — старт с чистой БД.
- Фронт на старте — Google Sheets sync + Lovable параллельно.
- 10 принципов надёжности в `docs/PLAN.md` — сырьё отдельно от расчётов, idempotent UPSERT, `ingestion_log`, view вместо таблиц для вывода, `v_data_quality`, `app_settings` key/value, история у всего что меняется.
- WB-комиссии берутся пер-артикул из отчёта (`wb_reports_fact`), не из `app_settings`.
- Карго: Excel-файл 1:1 → `china_orders` + `china_order_items` + `cargo_shipments` + `cogs_calculations` + `cogs_history`.

### Сделано
**Phase 1 — bootstrap + initial schema:**
- Структура репо из TEMPLATE: `CLAUDE.md`, `SYSTEM.md`, `SECURITY.md`, `NEW_PROJECT.md`, CI workflows.
- Миграция `0001_initial_schema.sql` — 7 таблиц (sku_catalog, wb_reports_fact_raw, wb_reports_fact, wb_stocks, wb_stocks_history, app_settings, ingestion_log).
- Миграция `0002_enable_rls.sql` — RLS на всех.
- Seed 7 ключей в `app_settings`.
- Helper-функции `app_setting_num()`, `app_setting_text()`.
- Фикс `automerge.yml` (ready_for_review + skip drafts).

**Phase 2-5 — автономно без токена:**
- 7 тестовых SKU в `sku_catalog` из Excel.
- Миграция `0003_china_cogs.sql` — 6 таблиц Китай/COGS + helper `cost_price_at()`.
- Миграция `0004_phase3_views.sql` — 10 view с `security_invoker=on`: `v_revenue_by_sku`, `v_commissions_by_sku`, `v_logistics_by_sku`, `v_sales_velocity`, `v_pnl_by_sku`, `v_warehouses_balance`, `v_turnover`, `v_supply_recommendation`, `v_ads_roi`, `v_data_quality`.
- Миграция `0005_fix_app_setting_helpers.sql` — схема-qualified `public.app_settings` под `search_path=''`.
- Edge Function `fetch-wb-stocks` — готов к деплою.
- Edge Function `sync-sheets` — stub, 503 без конфига.
- Shared `_shared/`: admin client, `runJob()` для `ingestion_log`, CORS.
- `supabase/config.toml` — verify_jwt=false для cron.

### Supabase проект
- Name: SellerBase
- Ref: `hcebwgjgppwaguqittpi`
- URL: https://hcebwgjgppwaguqittpi.supabase.co
- Region: eu-central-1 (Frankfurt)
- Publishable key: `sb_publishable_dmr1CASfRZR5jJDUOgLZuA_rKJ1uHHb`
- Tier: free ($0/мес)
- Advisors: **0 ERROR, 0 WARN**, 13 INFO (RLS без политик — ожидаемо до auth).

### Смерженные PR этой сессии
- #1 — bootstrap + initial schema (мержил вручную, draft).
- #2 — фикс automerge (ready_for_review + skip drafts).
- #3 — синхронизация репо с фактической БД + RLS.
- #4 — Phase 2-5: фетчеры, view, china/cogs, test SKUs.

### Ждёт владельца (утром)
1. **`WB_API_TOKEN`** — выпустить в ЛК Продавца (Настройки → Доступ к API, категории: Статистика + Аналитика + Продвижение). Дать мне.
2. **`SBP_ACCESS_TOKEN`** + **`SUPABASE_PROJECT_REF`** в GitHub Secrets (Settings → Secrets → Actions) — для автодеплоя Edge Functions.
3. (опционально) **`GOOGLE_SA_JSON`** + **`GOOGLE_SHEET_ID`** — для выгрузки в Google Sheets.
4. Активировать `pg_cron` extension в Supabase (Database → Extensions).

### Следующие шаги (когда будет токен)
1. Положить `WB_API_TOKEN` в Supabase Edge Function Secrets через MCP.
2. Деплой `fetch-wb-stocks` (через CI после заведения GitHub Secrets).
3. Пробный запуск → проверить `wb_stocks_history` и `ingestion_log`.
4. Cron на ежедневный запуск (SQL из `supabase/functions/fetch-wb-stocks/README.md`).
5. Фетчер `fetch-wb-report` (еженедельно, отчёт о реализации) → реальный P&L.
6. Фетчер `fetch-wb-ads` + миграция `0006_cash_flow.sql` (`marketing_expenses`, `cash_flow`).
7. Lovable web-дашборд.

### Ограничения среды
- Supabase CLI недоступен — миграции через MCP `apply_migration`.
- Deno недоступен — Edge Functions деплоятся через CI.
- WB API недоступен — нет токена.

### Незакрытые вопросы
Нет на момент конца сессии.
