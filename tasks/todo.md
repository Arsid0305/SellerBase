# Tasks — SellerBase

> Живой TODO. Принцип: один список, один порядок приоритета. Устаревшие секции удаляем, не накапливаем.

---

## 🔴 Сейчас в работе (доделка /dashboard)

- [ ] **Фото в Топ-5 / Категории** — проверить визуально после деплоя что подгружаются через `tm/1.webp`
- [ ] **Левый/правый блоки одной высоты** — реализовано через `[&>*]:h-full`, проверить визуально

---

## 🔴 Дальше после дашборда (по приоритету)

1. **migrate.yml workflow** — миграции из `supabase/migrations/` сейчас не доходят до БД через CI. Нужен workflow с `supabase db push` или `supabase-cli action`. Сейчас применяю руками через MCP — рискованно для среды.
2. **UAT остальных страниц** в порядке: `/products` → `/products/[id]` → `/products/costs` → `/pnl` → `/turnover` → `/analytics/*` → `/promo` → `/deficit` → `/supplies` → `/reviews` → `/customers` → `/tasks` → `/goals` → `/settings`
3. **Документация cron'ов** в одном месте (есть 5 cron, нет общей доки)

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

---

## 🔵 Перспектива (записано, не делать без явного запроса)

- Google Sheets sync — на паузе по решению владелицы
