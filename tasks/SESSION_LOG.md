# Session Log — SellerBase

> **Правило:** читать этот файл ПЕРВЫМ в начале каждой новой сессии или после перерыва.
> Самая верхняя запись = последняя сессия, точка возобновления.
> Append-only: новые записи — сверху, старые не удалять.

---

## 2026-05-30 (полный день) — rrd_id fix, перезалив, Google Sheets setup, доделать 2025

**Главный фикс**: WB возвращает несколько строк на один `srid` (продажа + логистика + хранение + штрафы), каждая с уникальным `rrd_id`. Старый дедуп по `srid` терял ~40% данных. **Миграция 0012** перевела уникальный ключ на `rrd_id`, YC-функция `fetch-wb-report` обновлена.

### PR-ы этого дня (все смержены)
- **#11** `fix: use rrd_id as unique row key` — миграция 0012 + апдейт YC.
- **#12** `feat(sync-sheets): GOOGLE_SA_JSON_B64 support` — base64-кодированный SA (yc CLI не любит запятые в env).

### Перезалив отчёта о реализации в БД (с правильным дедупом)
| Период | Строк | К перечислению |
|---|---|---|
| 2025-12 | 9 482 | 427 689 ₽ |
| 2026-01 | 7 517 | 550 589 ₽ |
| 2026-02 | 7 652 | 618 681 ₽ |
| 2026-03 | 8 021 | 581 953 ₽ |
| 2026-04 | 3 652 | 329 618 ₽ |
| 2026-05 | 1 851 | 177 752 ₽ |

Плюс отдельно загружен январь-февраль 2025 (18 409 строк).

### Сверка с UNIT.xlsx (январь 2026)
| Неделя | UNIT «Продажи из отчёта ВБ» | SellerBase | Δ |
|---|---|---|---|
| W1 01-04 | 34 116 ₽ | 35 419 ₽ | +3.8 % |
| W2 05-11 | 111 685 ₽ | 113 823 ₽ | +1.9 % |
| W3 12-18 | 146 398 ₽ | 149 614 ₽ | +2.2 % |

WB-кабинет Excel для отчёта 601767029: 149 099 ₽ → DB: 155 295 ₽ (с учётом второго отчёта 601767030 за тот же период — 6 195 ₽, сумма 155 294 ₽, **точно сходится**).

UNIT-таблица заполнена консервативно (без поздних корректировок WB), но в пределах 4 %.

### Token и WB API
- Создан **Персональный токен** (был Базовый, лимит 1 req/2h → теперь 1 req/min). Старый Базовый можно удалить.
- WB Statistics API возвращает заголовки `X-Ratelimit-*` — фетчер их читает и логирует в `ingestion_log.meta.rate_limit`. На 429 ждёт `X-Ratelimit-Retry`.
- Известная проблема: WB планирует **отключить `GET /api/v1/supplier/stocks` 23 июня** — нужна миграция на `POST /api/analytics/v1/stocks-report/wb-warehouses` (Analytics категория, Personal/Service токен).

### Phase 4 — финансы (миграция 0011)
- `marketing_expenses` (внешний маркетинг, не WB).
- `cash_flow` (приход/расход вне выручки).
- Функции `get_full_pnl_by_period(from, to)` + `get_pnl_totals(from, to)`.
- View `v_cash_flow_by_month`.

### Phase 5 — Google Sheets sync
- Google Service Account создан: `sellerbase@sellerbase.iam.gserviceaccount.com`
- Sheet ID: `1SaIQBfhId373TzJulNXOMGmjzdMtSgYrHp5PvoSliJw`
- 4 вкладки в таблице созданы и расшарены сервис-аккаунту (Editor).
- Код функции `sync-sheets` в репо (`yc-functions/sync-sheets/`), поддерживает `GOOGLE_SA_JSON_B64`.
- **Не задеплоено** — у owner вылетел контекст до запуска deploy-блока.

### YC infrastructure
- `fetch-wb-stocks` — daily 06:00 МСК (cron `0 3 * * *` UTC), 256 МБ.
- `fetch-wb-report` — Tuesday 06:00 МСК (cron `0 3 * * 2` UTC), **512 МБ** (увеличено сегодня, квартальные чанки крашили 256 МБ).
- `sync-sheets` — НЕ создан, deploy-блок ждёт owner.

### Незакрытые задачи (приоритет вниз)
1. **Owner: deploy `sync-sheets`** в YC (блок команд был дан в чате, не выполнен; токены и base64 SA нужно собрать заново или взять из истории чата). После — `pg_cron` `0 * * * *`.
2. **Owner: догрузить март-ноябрь 2025** помесячно (квартальные крашили 256 МБ; после редеплоя до 512 МБ — должно пройти). Команды:
   ```bash
   for M in 03 04 05 06 07 08 09 10 11; do
     curl -s -X POST "https://functions.yandexcloud.net/d4e4s8o3oqd27qv6gs94?from=2025-$M-01&to=2025-$M-31" -d '{}'; echo
     sleep 90
   done
   ```
3. Сверить год 2025 целиком с UNIT_WB_2025.xlsx.
4. Миграция фетчера на `/api/analytics/v1/stocks-report/wb-warehouses` до 23 июня (старый `/supplier/stocks` отключат).
5. Phase 4 v2: переписать `calculate_cogs_for_shipment` под комплекты.
6. Lovable дашборд (Phase 5 продолжение).

### Урок про OAuth
- В этом чате я не смог обновить SESSION_LOG через GitHub MCP (нужна повторная авторизация). Owner получила ссылку, но Chrome перехватил её на Google Drive MCP. В итоге этот лог она вставила вручную через github.com → Edit file.

### Состояние секретов
WB Personal token, Supabase service_role, YC SA private key, Google SA private key — все засветились в чате. Owner решила не ротировать (управляемый риск, соло-владелец, один ноут).

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
  - Дедуп по `srid` внутри страницы → upsert (**заменено на `rrd_id` 30 мая**).
  - WebSocket-полифилл (`globalThis.WebSocket = require('ws')`) для @supabase/supabase-js на Node 18.
- Обе функции `allow-unauthenticated-invoke`, env-vars выставлены.
- `pg_cron` переключён:
  - `fetch-wb-stocks-daily` `0 3 * * *` → YC stocks (06:00 МСК)
  - `fetch-wb-report-weekly` `0 3 * * 2` → YC report (вторник 06:00 МСК)
  - старый daily-backup удалён.

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
