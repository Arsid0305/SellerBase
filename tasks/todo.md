# Tasks — SellerBase

## [2026-06-15 — актуально]

### 🔴 Доделка /dashboard (текущая итерация)

- [x] **WB-style график СВЕРХУ** над PnLChart — подключён
- [x] **Tooltip на PnLChart** — реализован при hover, значения всех активных линий
- [x] **«vs позавчера» в брифе** — заменено на «vs 13 июн» (конкретная дата)
- [ ] **Фото в Топ-5 / Категории** — проверить что подгружаются через `tm/1.webp`
- [ ] (накидывает пользователь)

### 🔴 Открытое из критики

- [x] **Stocks API миграция** — ✅ переписан на `/api/v1/warehouse_remains` (асинхронный + polling). Заработает когда токен обновят
- [ ] **migrate.yml workflow** — миграции из `supabase/migrations/` не доходят до БД через CI
- [ ] **UAT остальных страниц** после /dashboard: /products → /products/[id] → /products/costs → /pnl → /turnover → /analytics/* → /promo → /deficit → /supplies → /reviews → /customers → /tasks → /goals → /settings

### 🟢 Сделано в текущей итерации (PR #116 + #117 в работе)

- ✅ Маржа 50% → реальная 24-30% (RPC R14 + cogs/tax)
- ✅ Единый PnLChart с 9 линиями + чекбоксы + двойная Y-ось (на /dashboard и /pnl)
- ✅ Tooltip на PnLChart при hover
- ✅ /pnl таблица per-SKU + экспорт CF_PL.xlsx
- ✅ /dashboard новая раскладка: Бриф 2/3 + (Воронка + Рейтинг) справа, 3 столбика (Категории/Аномалии/Топ-5), пульс внизу
- ✅ KPI Grid 5 карточек (включая «Маржа» отдельной с дельтой п.п.)
- ✅ Категория = `subject_name`, бейдж «vs позавчера» с цветом, дата заголовка брифа = последний день с данными
- ✅ Tooltip «Критичный SKU» / «Метки» / «Хватит» / «В/Д/Ц»
- ✅ /products каталог: убраны Канал/Бренд/Послед.продажа, селекты фильтров Lifecycle/Margin/StockDays, сортировка отключена
- ✅ Фото fallback wbPhotoUrl + путь `tm/1.webp`
- ✅ Прессы для чеснока — is_active=false
- ✅ Убран нерабочий поиск из топбара
- ✅ Воронка query + FunnelCard + RatingCard на дашборде
- ✅ RPC `get_sales_hourly` + query `fetchSalesComparison` для WB-style chart
- ✅ Авто-PR workflow для claude-веток
- ✅ Правила §6-§11a (токены / UI ширина / период 30д / живой TODO / делегирование агентам / выбор модели / полная цепочка push→main)

### 🟡 Можно делать без согласования

- [ ] **Granularity picker** во всех отчётах с диапазоном — день/неделя/месяц/квартал/год
- [ ] **Smoke-тесты Playwright** — все страницы открываются без ошибок
- [ ] **Юнит-тесты SQL-формул** P&L, оборачиваемость, ABC/XYZ
- [ ] **Data Quality view** — единое окно «что не в порядке с данными»
- [ ] **Анализатор маржи «почему падает»** view + UI
- [ ] **Точка безубыточности** — для каждого SKU при какой цене маржа = 0
- [ ] **Симулятор цены** — «при цене X маржа Y%»
- [ ] **Telegram алерты** при падении маржи/выкупа
- [ ] **Документация cron'ов** в одном месте

### 🔮 Backlog (новые edge functions)

- [ ] **`fetch-wb-orders`** → вкладка «Заказы» в WB-style chart (Statistics API `/api/v1/supplier/orders`, таблица `wb_orders_fact`, cron 30 мин)
- [ ] **`fetch-wb-ads`** → вкладка «Продвижение» + Маркетинг как реальная статья P&L (`/adv/v1/...`, таблица `wb_ads_fact`, daily)
- [ ] **`fetch-wb-content`** заполнит `sku_catalog.rating` + reviews_count
- [ ] **Окно `fetch-wb-funnel-aggregate` 60 → 30 дней** → % выкупа совпадёт с WB-кабинетом

### ⏸ Ждём от пользователя

- Параметры порогов промо-светофора (целевая маржа ≥25% / 15-25% / <15%, мин. остаток)
- Excel «Заказы Китай», «Фулфилмент», «Поставки» — для автосебеса

### 🔵 Перспектива

- **Автоматический себес** roadmap: `china_order_items` + `supplies_transport` + `fulfillment_costs` + `delivery_to_wb` → view `v_sku_cost_breakdown`
- **Google Sheets sync** — на паузе
- **Лайфсайклы товаров** (Events / Anomaly / Trust-Visibility-Value / Goals)
- **Excel-экспорт** в шаблон владелицы
- **Office Add-in / Power Query** — отложено

---

## [2026-06-14 — устарело]

### 🔴 Критическое (в первую очередь)

- [ ] **Проверить что cron `fetch-wb-sales-30min` живой.** Миграция PR #109 смержена, но автоприменения нет:
  ```sql
  SELECT * FROM cron.job WHERE jobname = 'fetch-wb-sales-30min';
  ```
  Если пусто — выполнить SQL из `supabase/migrations/20260614_cron_fetch_wb_sales.sql` руками в SQL Editor.
- [ ] **UAT остальных страниц** (продолжение от /dashboard): /products → /products/[id] → /products/costs → /pnl → /turnover → /analytics/* → /promo (новая матрица) → /deficit → /supplies → /reviews → /customers → /tasks → /goals → /settings.
- [ ] **«50% маржа» на /pnl** — владелица заметила странное число. Сверить `v_margin_breakdown_weekly` с эталоном 01-07.12.2025.
- [ ] **migrate.yml workflow** — миграции из `supabase/migrations/` сейчас не доходят до БД (deploy.yml деплоит только функции). Нужен workflow с `supabase db push` либо переход на supabase-cli action.
- [ ] **Stocks API миграция** — WB отключает `/api/v1/supplier/stocks` 23.06.2026 (осталось ~9 дней). Переписать `fetch-wb-stocks` на `/api/analytics/v1/stocks-report/wb-warehouses`. Сейчас 401 каждый день, остатки не льются.

### 🟡 Можно делать без согласования

- [ ] **Granularity picker** во всех отчётах с диапазоном — день/неделя/месяц/квартал/год
- [ ] **Smoke-тесты в Playwright** — все страницы открываются без ошибок
- [ ] **Юнит-тесты SQL-формул** P&L, оборачиваемость, ABC/XYZ — эталонные данные + ожидаемые числа
- [ ] **Data Quality view** — единое окно «что не в порядке с данными»
- [ ] **fetch-wb-content** — карточки товаров (рейтинги/отзывы), авто-обновление subject_name для новых SKU
- [ ] **Анализатор маржи «почему падает»** view + UI (комиссия выросла / хранение съело / возвраты)
- [ ] **Точка безубыточности** — для каждого SKU при какой цене маржа = 0
- [ ] **Симулятор цены** — «при цене X маржа Y%»
- [ ] **Telegram алерты** при падении маржи/выкупа
- [ ] **Документация cron'ов** в одном месте
- [ ] **Гемини-аудит follow-ups:** cogs_history для исторического P&L; YC fetch-wb-report timeout
- [ ] **ChatGPT-аудит:** автотесты на P&L формулы

### ⏸ Ждём от пользователя

- Параметры порогов промо-светофора (целевая маржа ≥25% / 15-25% / <15%, мин. остаток)
- Excel «Заказы Китай», «Фулфилмент», «Поставки» — для автосебеса

### 🔵 Перспектива

- **Автоматический себес** roadmap: `china_order_items` + `supplies_transport` + `fulfillment_costs` + `delivery_to_wb` → view `v_sku_cost_breakdown`
- **Google Sheets sync** — на паузе по решению владелицы. Backend готов (`sync-sheets` v0.5), id таблицы 1SaIQB... в `pricing_settings`. Возвращаться когда сама скажет.
- **Лайфсайклы товаров** (Events / Anomaly / Trust-Visibility-Value / Goals)
- **Excel-экспорт** в шаблон владелицы (templates/CF_PL_template_wb_only.xlsx есть)
- **Office Add-in / Power Query** — отложено

### Сделано в этой сессии (14.06)
- UAT /dashboard: 7 фиксов (даты, лейблы, KPI стрелки, логист пульс, каналы, период в шапке)
- Запятая в CSV, цвет канала-маркетплейса
- Промо матрица + XLSX-шаблон + parse
- KpiCard arrow direction фикс
- Costs editor focus фикс
- P&L returns/penalty фикс
- `fetch-wb-sales` Edge Function (+ миграция + cron) — новый канал ежедневных продаж
- Чистка БД: 660 MB → 101 MB (дроп `wb_reports_fact_raw` 459 MB)
- CI deploy.yml починен + GitHub Secrets для функций

---

## [2026-06-13 — устарело]

### 🔴 Критическое (брать в первую очередь)

- [ ] **Stocks API миграция** — WB отключает `/api/v1/supplier/stocks` 23.06.2026. Переписать `fetch-wb-stocks` на новый `/api/analytics/v1/stocks-report/wb-warehouses`. Сейчас 401 каждый день, остатки не льются.
- [ ] **Промо-модуль: UI `/promo`** — список акций, таблица SKU с маржей сейчас vs при акции, чекбокс «участвую», CSV-экспорт для массовой загрузки в WB-кабинет. Backend готов (`v_promo_margin_calc`, `wb_promotions`, `wb_promotion_items.user_participate`). UI — основная работа.
- [ ] **Сверка PR #86 merge** — margin polish, готов к мержу
- [ ] **Дёрнуть свежий `fetch-wb-promotions`** и посмотреть какие SKU реально приходят для активных промо

### 🟡 Можно делать без согласования (тихие)

- [ ] **fetch-wb-content** edge function — карточки товаров (рейтинги, отзывы), авто-обновление subject_name для новых SKU
- [ ] **fetch-wb-goods-returns** — отдельный endpoint возвратов (был в плане)
- [ ] **Анализатор маржи** — view+UI «почему падает» (комиссия выросла / хранение съело / возвраты)
- [ ] **Точка безубыточности** — для каждого SKU при какой цене маржа = 0
- [ ] **Симулятор цены** — «при цене X маржа Y%»
- [ ] **Уведомления Telegram** — алерты при падении маржи/выкупа
- [ ] **Дашборд `/dashboard`** в приложении — главная страница со всеми KPI
- [ ] **Графики по неделям/месяцам** — динамика метрик
- [ ] **Бэкфил subject** в `wb_reports_fact_raw` (массовый)
- [ ] **Документация cron'ов** в одном месте
- [ ] **Smoke-тесты** на views (нет покрытия)

### ⏸ Ждём от пользователя

- **Excel-файлы для автосебеса:** «Заказы Китай», «Фулфилмент», «Поставки»
- **Параметры порогов** для промо-светофора: целевая маржа (≥25% / 15-25% / <15%), минимальный остаток для участия

### 🔵 Перспектива

- **Google Sheets sync** — на паузе по решению владелицы. Backend готов (`sync-sheets` v0.5), id таблицы 1SaIQB... сохранён в `pricing_settings`. Логика заливает в листы Дашборд / PL WB / PL WB (нед). Возвращаться когда сама скажет.
- **Автоматический себес** roadmap: `china_order_items` + `supplies_transport` + `fulfillment_costs` + `delivery_to_wb` → view `v_sku_cost_breakdown`
- **Лайфсайклы товаров** (Events / Anomaly / Trust-Visibility-Value / Goals)
- **Excel-экспорт** в шаблон владелицы (templates/CF_PL_template_wb_only.xlsx есть)
- **Office Add-in / Power Query** — отложено

### Сделано в этой сессии (13.06)

- [x] Полный комплект views для воронки/маржи
- [x] fetch-wb-commissions + weekly cron
- [x] v_sku_weighted_tariff (тарифы по факту распределения SKU)
- [x] Реальная оборачиваемость как storage_days
- [x] 80/80 SKU имеют subject_name
- [x] PR #85 merged (главный комплект)
- [x] PR #86 открыт (margin polish)

---

## [2026-06-11 — устарело]

### ⏸ Ждём от пользователя

- **Файл «Промо-акции»** — владелица пришлёт завтра свой существующий шаблон/файл. На его основе адаптировать модуль `wb_promotion_items` + view `v_wb_promotion_margin` + UI `/promo`.

### 🔵 Перспектива (записано, не делать без явного запроса)

- **Google Sheets sync** — sync-sheets v0.5 деплоится, ID существующей таблицы 1SaIQB... сохранён в pricing_settings. Логика заливает в листы Дашборд / PL WB / PL WB (нед). Пробный запуск был — таблицу нужно будет почистить руками или дополнить функцию (`?cleanup=1`). На паузе по решению владелицы. Возвращаться когда сама скажет.

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

### Следующий приоритет (после получения файла акций)

- [ ] **Промо-акции WB** — модуль маржа+оборачиваемость+календарь+история+симулятор. Таблицы и edge function `fetch-wb-promotions` уже созданы (рейт-лимит фиксится). Жду формат файла владелицы. Себес обновлён из UNIT.xlsx «Себес до ВБ».
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
