# Tasks — SellerBase

## [2026-06-11 — актуально]

### Сделано в этой сессии

- [x] Унифицирован `WB_TOKEN_READ` для всех WB edge-функций
- [x] Починен `fetch-wb-report`: upsert по `rrd_id`, поддержка `?from=&to=`
- [x] Перезалит весь 2025 — все 10 новых колонок (`storage_fee`, `acquiring_fee`, `rebill_logistic_cost`, `deduction`, `additional_payment` и т.д.)
- [x] Добавлены колонки `ppvz_spp_prc`, `commission_percent`, `ppvz_kvw_prc`
- [x] Найдена формула R14 «Продано по цене карточки» = `SUM(retail_price × qty)` Продажи − Возвраты руб
- [x] Создан view `v_wb_pl_weekly` — agregat по `realizationreport_id` со всеми метриками PL WB (нед)
- [x] Сверка с Excel 2025: основные метрики совпадают в пределах 0.5–4.5%
- [x] Зафиксированы правила в `tasks/rules.md`: тестовая неделя 01.12–07.12.2025 для любых новых формул

### Отложено (по решению пользователя)

- [ ] **Платная приёмка** — отдельная подсистема WB, не в `reportDetailByPeriod`. Нужен отдельный edge-function (предположительно `/api/v1/acceptance-report` или из FBO accept-report). Цифра за 2025: ~39 785 ₽ (из Excel). Вернуться когда понадобится точная сверка PL.

### Следующий приоритет

- [ ] **Тарифы складов из факта** — средний реальный тариф ₽/л на склад из `delivery_rub / volume_l` и `storage_fee / volume_l / дни`. Нужно для калькулятора будущих поставок (текущая `wb_tariffs_box` отдаёт **планируемые** тарифы, а владелице нужны фактические для прогноза).

### Из старого плана (ещё актуально)

- [ ] **Excel-синхронизация (CF & PL 2026)** — этап A (Скачать XLSX), B (Power Query), C (Office Add-in)
- [ ] **Лайфсайклы товаров** PR #47 — ждать мержа, потом Events / Anomaly / Trust-Visibility-Value / Versioning / Goals
- [ ] **Себестоимость** — подстраница «Мои товары → Себестоимость»: таблица SKU + inline edit + импорт CSV + история
- [ ] **Анализатор маржи** «почему падает»
- [ ] **Дизайн-проход** — лёгкий воздушный, один экран
- [ ] **Промо-акции модуль** с расчётом маржи
- [ ] **Точка безубыточности**, **симулятор цены**

### Инфраструктура отложено

- [ ] **VAPID-ключи** для push notifications (заглушки в коде)
- [ ] **GitHub Secrets** для деплоя edge-functions через CI (`SBP_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`)
- [ ] **Анализ комиссии WB** — `ppvz_sales_commission` поле приходит почти всегда 0 в WB API. Используем `commission_full_rub = R14 − R20` в view. Если нужно различать «чистую» комиссию и СПП — добавить отдельные расчёты на основе `commission_percent` и `ppvz_spp_prc`.

---

## [2026-06-04 — устарело]

### Excel-синхронизация (CF & PL 2026)

Шаблон владельца: `CF and PL 2026.xlsx` (вкладки PL общ / PL WB / PL OZON / PL WB (нед) / PL OZON (нед) / CF / CF (нед) / Дашборд).
Ручные входы только на вкладках `PL WB (нед)` и `PL OZON (нед)` — остальное формулы.

- [ ] **Этап A** — Кнопка «Скачать XLSX» в приложении. Сервер берёт шаблон, заполняет ячейки-входы (продажи шт, выручка, OPEX по неделям) из Supabase через openpyxl/exceljs. Формулы и Дашборд остаются. Полностью офлайн после скачивания.
- [ ] **Этап B** — После теста A: подключить Power Query внутри файла к REST-эндпоинту `/api/finance/weekly`. Кнопка «Обновить» в Excel тянет данные. Настройка в спокойном режиме.
- [ ] Этап C (опционально, позже) — Excel Add-in / OfficeJS с панелью Sync.

### Лайфсайклы товаров (текущий PR #47)
- [ ] Дождаться мерджа #47 → подключить LifecycleBadge в карточку товара
- [ ] Day 2: Events (events table + v_events + UI)
- [ ] Day 3: Anomaly detection
- [ ] Day 4: Trust/Visibility/Value computed columns
- [ ] Day 5: Versioning of product cards
- [ ] Day 6-7: Goals/Tasks layers

### Себестоимость
- [ ] Подстраница «Мои товары → Себестоимость»: таблица SKU + inline edit + импорт CSV + история (`sku_cost_history` с valid_from/valid_to)

---

## [2026-05-29 — устарело]

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
