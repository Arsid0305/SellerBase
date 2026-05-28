# Tasks — SellerBase

## [2026-05-29 — актуально]

**Текущий этап:** ожидание WB_API_TOKEN для запуска фетчеров.

### Supabase проект
- Name: SellerBase
- Ref: `hcebwgjgppwaguqittpi`
- URL: https://hcebwgjgppwaguqittpi.supabase.co
- Region: eu-central-1 (Frankfurt)
- Publishable key: `sb_publishable_dmr1CASfRZR5jJDUOgLZuA_rKJ1uHHb`

### Сделано
- [x] Phase 1: bootstrap, schema, RLS, app_settings, helpers.
- [x] Phase 2 (код): `fetch-wb-stocks` Edge Function в репо. Деплой — ждёт секретов.
- [x] Phase 3: 10 view (`v_revenue_by_sku`, `v_commissions_by_sku`, `v_logistics_by_sku`, `v_sales_velocity`, `v_pnl_by_sku`, `v_warehouses_balance`, `v_turnover`, `v_supply_recommendation`, `v_ads_roi`, `v_data_quality`) — все с `security_invoker=on`.
- [x] Phase 4: 6 таблиц Китай/COGS (`china_orders`, `china_order_items`, `cargo_shipments`, `cargo_shipment_orders`, `cogs_calculations`, `cogs_history`) + helper `cost_price_at()`.
- [x] Phase 5 (код): `sync-sheets` Edge Function-stub.
- [x] 7 тестовых SKU в `sku_catalog` (из Excel).
- [x] `v_data_quality` подсвечивает 7 SKU без cost_price — sanity check работает.

### Ожидает владельца
- [ ] `WB_API_TOKEN` — выпустить в ЛК Продавца, дать мне.
- [ ] (опционально) `GOOGLE_SA_JSON` + `GOOGLE_SHEET_ID` — для выгрузки в знакомую Google-таблицу.
- [ ] (опционально) Грузить реальный файл расчёта карго в `china_orders` (вернёмся когда дойдём до миграции истории).

### После токена (Phase 2, финал)
- [ ] Положить `WB_API_TOKEN` в Supabase Edge Function Secrets.
- [ ] Добавить `SBP_ACCESS_TOKEN` и `SUPABASE_PROJECT_REF` в GitHub Secrets (для автодеплоя).
- [ ] Деплой `fetch-wb-stocks` и `sync-sheets`.
- [ ] Ручной пробный запуск `fetch-wb-stocks` → проверить `wb_stocks_history` и `ingestion_log`.
- [ ] Активировать `pg_cron` в Supabase и поставить расписание из fetch-wb-stocks/README.md.

### Дальше (Phase 2 cont. + Phase 5 финал)
- [ ] Фетчер `fetch-wb-report` (отчёт о реализации, /api/v1/supplier/reportDetailByPeriod) — еженедельно.
- [ ] Фетчер `fetch-wb-ads` (/adv/v1/promotion/*) — ежедневно + таблица `marketing_expenses`.
- [ ] Миграция `0006_cash_flow.sql` (`cash_flow`, `marketing_expenses`).
- [ ] Lovable web-дашборд.
- [ ] Сверка P&L с историческим Excel.

### Контекст
- RLS включён на всех 13 таблицах без политик — доступ только service_role.
- Helper-функции (`app_setting_num`, `app_setting_text`, `cost_price_at`) используют `set search_path=''` и `public.<table>`.
- Advisors: 0 ERROR, 0 WARN, 13 INFO (RLS без политик — ожидаемо до auth).
- WB API base: `https://statistics-api.wildberries.ru`.

## [2026-05-28 — устарело]
- Phase 1: bootstrap + initial schema — сделано.
- Phase 1 sync (PR #3): фикс inline unique, RLS, search_path — сделано.
