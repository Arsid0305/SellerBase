# Tasks — SellerBase

## [2026-05-29 — актуально]

**Текущий этап:** ждём первый fetch-wb-report (cron утром) → реальный P&L.

### Supabase проект
- Ref: `hcebwgjgppwaguqittpi`
- URL: https://hcebwgjgppwaguqittpi.supabase.co
- Edge Functions: `fetch-wb-stocks` v1, `fetch-wb-report` v2 — ACTIVE.
- Cron: stocks daily 09:00 МСК, report weekly Пн 09:30, report daily-backup 10:00.

### Сделано
- [x] Phase 1: bootstrap, schema, RLS, app_settings.
- [x] Phase 2 (stocks): live, 60 строк, idempotent.
- [x] Phase 2 (report): задеплоен, ждём WB cooldown.
- [x] Phase 3: 10 view, security_invoker=on.
- [x] Phase 4: Китай/COGS схема + функция.
- [x] Карго-партия загружена (47 позиций, 160 091.60 руб).
- [x] Каталог из `Себес` UNIT.xlsx — 80 SKU, 14 kit / 66 single, все с правильным cost_price_rub.
- [x] sku_catalog расширен: bundle_type, cost_price_source, ozon_article.
- [x] v_data_quality.sku_no_cost = 0.

### Следующий приоритет
- [ ] Первый успешный fetch-wb-report (утром cron) → реальный P&L в v_pnl_by_sku.
- [ ] Сверка v_pnl_by_sku с вкладкой Себес/Юнит по 5-10 SKU.
- [ ] Phase 5: Lovable web-дашборд.
- [ ] Phase 4 v2: переписать calculate_cogs_for_shipment под kit логику (сумма компонентов).

### Ожидает владельца
- [ ] `SBP_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` в GitHub Secrets — для автодеплоя.
- [ ] (опционально) `GOOGLE_SA_JSON` + `GOOGLE_SHEET_ID`.

### Контекст
- WB token (read-only) в Supabase Edge Function Secrets.
- /reportDetailByPeriod жёстко лимитируется при частых вызовах.
- Из 47 карго-позиций 8 SKU — kit-наборы. Их cost_price пришла из `Себес` листа, не из автоматического расчёта (который бы выдал неверные числа — делил бы cost на число компонентов вместо суммирования).

## [2026-05-28 — устарело]
- Phase 1 + Phase 2-5 подготовка.
