# Tasks — SellerBase

## [2026-05-29 — актуально]

**Текущий этап:** Phase 2-3 запущены, P&L работает на тестовых.

### Supabase проект
- Ref: `hcebwgjgppwaguqittpi`
- URL: https://hcebwgjgppwaguqittpi.supabase.co
- Edge Functions: `fetch-wb-stocks` v1, `fetch-wb-report` v2 — ACTIVE.
- Cron: `fetch-wb-stocks-daily` (09:00 МСК), `fetch-wb-report-weekly` (Пн 09:30 МСК), `fetch-wb-report-daily-backup` (10:00 МСК).

### Сделано
- [x] Phase 1: bootstrap, schema, RLS, app_settings.
- [x] Phase 2 (stocks): `fetch-wb-stocks` живой, 60 строк остатков загружено, idempotent UPSERT проверен.
- [x] Phase 2 (report): `fetch-wb-report` задеплоен и подвязан к cron. Первый ручной вызов 429 из-за WB rate limit — ждём автоматический запуск утром.
- [x] Phase 3: 10 view с `security_invoker=on`.
- [x] Phase 4: Китай/COGS схема + функция `calculate_cogs_for_shipment()`.
- [x] Карго-партия загружена (1 заказ, 47 позиций, 1 отгрузка). 40 SKU получили cost_price_rub.
- [x] sku_catalog: 41 SKU (40 из карго + 1 тестовый без карго).
- [x] Sanity-check аллокации карго: сумма по SKU 160091.57 = shipment.total_cargo_rub 160091.60 (округление).

### Следующий приоритет
- [ ] Дождаться первого успешного запуска `fetch-wb-report` (cron утром) → реальный P&L в `v_pnl_by_sku`.
- [ ] Сверка P&L с `UNIT WB факт 2025` по 1-2 SKU (<1% расхождение).
- [ ] Phase 5: Lovable web-дашборд.

### Ожидает владельца
- [ ] `SBP_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` в GitHub Secrets — для автодеплоя Edge Functions через `deploy.yml`.
- [ ] (опционально) `GOOGLE_SA_JSON` + `GOOGLE_SHEET_ID` — выгрузка P&L в знакомую Google-таблицу.
- [ ] (в перспективе) Отдельный WB write-токен для управления ценами (Phase 7).

### Контекст
- WB токен в Supabase Edge Function Secrets (не в GitHub).
- /api/v5/supplier/reportDetailByPeriod жёстко лимитируется при частых вызовах (>5 мин кулдаун).
- Из 47 позиций карго — 40 уникальных my_article (некоторые WB-карточки содержат несколько размеров). Себестоимость усреднёна по SKU.

## [2026-05-28 — устарело]
- Phase 1: bootstrap + initial schema.
- Phase 2-5 автономная подготовка.
