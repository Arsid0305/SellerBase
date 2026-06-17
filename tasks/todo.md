# Tasks — SellerBase

> Живой TODO. Принцип: один список, один порядок приоритета. Устаревшие секции удаляем, не накапливаем.

---

## 🔴 Сейчас в работе (доделка /dashboard)

- [ ] **Фото в Топ-5 / Категории** — проверить визуально после деплоя что подгружаются через `tm/1.webp`
- [ ] **Левый/правый блоки одной высоты** — реализовано через `[&>*]:h-full`, проверить визуально

---

## 🔴 Дальше после дашборда (по приоритету)

1. **migrate.yml workflow** — миграции из `supabase/migrations/` сейчас не доходят до БД через CI. Нужен workflow с `supabase db push` или `supabase-cli action`. Сейчас применяю руками через MCP — рискованно для среды.
2. **Документация cron'ов** в одном месте (есть 5 cron, нет общей доки)

### UAT — сделано в эту сессию (17 июня 2026)

- ✅ `/pnl` — поиск по артикулу, sticky шапка/итоги, подсветка убыток/маржа, плейсхолдер графика
- ✅ `/turnover` — фото, поиск, подсветка, tooltip сегментов, sort
- ✅ `/products/[id]` — tone по знаку прибыли/маржи, hint-tooltip, onError фото, цвет канала
- ✅ `/products/costs` — поиск по артикулу, sticky шапка, tooltip, пустое состояние
- ✅ `/analytics/*` (4 страницы) — tooltip-ы метрик, tabular-nums, единый formatRub
- ✅ `/promo` — поиск, пороги маржи 15/25%, tooltip-ы, мёртвый код убран
- ✅ `/deficit` — фото, поиск, tooltip, emerald для OK
- ✅ `/supplies` — formatInt, tooltip формулы «Везти», debounce поиска, sticky шапка
- ✅ `/reviews` — фото товаров, поиск по артикулу, ratingTone (≥4.5 emerald, <3.5 rose)
- ✅ `/customers`, `/tasks`, `/goals`, `/settings/notifications` — tabular-nums, tooltip-ы, overdue rose, единый formatRub

---

## 🟡 Можно делать в фоне без согласования

- **Granularity picker** во всех отчётах с диапазоном — день/неделя/месяц/квартал/год
- **Анализатор маржи «почему падает»** view + UI (комиссия выросла / хранение съело / возвраты)
- **Точка безубыточности** — для каждого SKU при какой цене маржа = 0
- **Симулятор цены** — «при цене X маржа Y%»
- **Telegram алерты** при падении маржи/выкупа
- **Data Quality view** — единое окно «что не в порядке с данными»
- **Smoke-тесты Playwright** — все страницы открываются без ошибок
- **Юнит-тесты SQL-формул** P&L, оборачиваемость, ABC/XYZ

---

## 🔮 Backlog (новые Edge Functions / большие фичи)

- **`fetch-wb-orders`** → вкладка «Заказы» в WB-style chart (Statistics API `/api/v1/supplier/orders`, таблица `wb_orders_fact`, cron 30 мин)
- **`fetch-wb-ads`** → вкладка «Продвижение» + Маркетинг как реальная статья P&L (`/adv/v1/...`, таблица `wb_ads_fact`, daily)
- **`fetch-wb-content`** заполнит `sku_catalog.rating` + reviews_count + subject_name для новых SKU
- **Окно `fetch-wb-funnel-aggregate` 60 → 30 дней** → % выкупа совпадёт с WB-кабинетом (~83% вместо 76.5%)
- **Автоматический себес** roadmap: `china_order_items` + `supplies_transport` + `fulfillment_costs` + `delivery_to_wb` → view `v_sku_cost_breakdown`
- **Лайфсайклы товаров** (Events / Anomaly / Trust-Visibility-Value / Goals)
- **Excel-экспорт** в шаблон владелицы (`templates/CF_PL_template_wb_only.xlsx`)
- **Office Add-in / Power Query** — отложено

---

## ⏸ Ждём от пользователя

- Параметры порогов промо-светофора (целевая маржа ≥25% / 15-25% / <15%, мин. остаток)
- Excel «Заказы Китай», «Фулфилмент», «Поставки» — для автосебеса
- Включение прав в Settings → Actions → General уже сделано (auto-pr.yml должен работать)

---

## 🟢 Сделано в июне 2026 (свёрнуто)

**P&L и финансы:**
- RPC `get_pnl_by_period` v3 — R14 (retail_price × qty) + cogs + tax + все расходы
- RPC `get_daily_pnl_series` v3 — с cogs/tax + margin_pct
- RPC `get_sales_hourly` — почасовая агрегация выкупов
- Маржа 50% → реальная 24-30%
- Единый `PnLChart` (9 линий, чекбоксы, двойная Y-ось, tooltip при hover) на /dashboard и /pnl
- `/pnl` — таблица per-SKU + экспорт CF_PL.xlsx
- `WbStyleChart` (4 таба + селектор + 3 линии сравнения + KPI) над PnLChart на /dashboard

**Утренний бриф:**
- WB-стиль (2 блока: Количество + Сумма) с дельтой «vs 13 июн»
- Дата заголовка = последний день с данными
- Tooltip «Критичный SKU»

**`/dashboard` раскладка:**
- Бриф 2/3 + (Воронка + Рейтинг) 1/3 (одной высоты)
- KPI Grid 5 карточек (Маржа отдельной)
- PnLChart + WbStyleChart
- 3 столбика внизу: Категории / Аномалии / Топ-5
- Логистический пульс перед подписью

**`/products` каталог:**
- Убраны Канал/Бренд/Послед.продажа
- Селекты фильтров Lifecycle/Margin/StockDays
- Сортировка отключена
- Tooltip на «Метки» / «Хватит» / «В/Д/Ц»
- Категория = `subject_name`
- Фильтры в шапке

**Инфраструктура:**
- Stocks API переписан на `/api/v1/warehouse_remains` (async + polling)
- `fetch-wb-sales` + cron 30 мин
- Чистка БД: 660 MB → 101 MB
- `deploy.yml` починен + GitHub Secrets
- `auto-pr.yml` — авто-открытие PR для claude-веток
- Фото fallback `wbPhotoUrl(nm_id)` + путь `tm/1.webp`

**Правила (`tasks/rules.md` §6-§11a):**
- §6 — не дёргать про токен при 401
- §7 — UI без горизонтального скролла
- §8 — период по умолчанию 30 дней
- §9 — живой TODO + автономная работа
- §10 — полная цепочка push→PR→CI→main (zero-touch для пользователя)
- §11 — делегирование агентам как основной режим
- §11a — выбор модели (sonnet default, opus редко)

---

## 🔵 Перспектива (записано, не делать без явного запроса)

- Google Sheets sync — на паузе по решению владелицы
