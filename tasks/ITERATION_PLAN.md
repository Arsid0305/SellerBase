# План работ — живой TODO

## Принцип: ОДНА правка → коммит → ждать билд → следующая.
Если пользователь даёт новую задачу — добавляю в **🔴 Очередь** и НЕ пропускаю.

---

## 🔴 Очередь (сделать сейчас)

- [ ] **WB-style график на /dashboard** (большая фича):
  - [ ] RPC `get_sales_hourly(date_from, date_to)` — почасовая агрегация `wb_sales_fact`
  - [ ] Query `fetchSalesHourly`
  - [ ] Компонент `WbStyleChart` (4 таба + селектор Сегодня/Вчера/Неделя/Месяц + 3 линии сравнения + KPI блоки)
  - [ ] Подключить на /dashboard вместо `PnLChart`
  - [ ] Заглушки для «Заказы» и «Продвижение» (нет данных)
- [ ] **Воронка + Оценка товара** рядом с утренним брифом
  - [x] Query `fetchSellerAnalytics` (funnel + rating)
  - [ ] Компонент `FunnelCard` (12.6% / 36.2%)
  - [ ] Компонент `RatingCard` (рейтинг + выкуп %)
  - [ ] Подключить на /dashboard справа от брифа
- [ ] **Цифры неправильные** — пользователь не уточнил какие. Спросить при удобном случае.
- [ ] **Фильтры каталога — убрать сортировку** из колонок (стрелки `↕` всех колонок отключить, `enableSorting: false`)

---

## 🟡 Фикс по факту (когда появятся данные)

- [ ] **`fetch-wb-content`** заполнит `sku_catalog.rating` — после него RatingCard покажет реальный рейтинг (сейчас «—»).
- [ ] **`fetch-wb-orders`** → вкладка «Заказы» в WbStyleChart активируется.
- [ ] **`fetch-wb-ads`** → вкладка «Продвижение» в WbStyleChart активируется.
- [ ] **Поменять `fetch-wb-funnel-aggregate` с 60д на 30д** → % выкупа совпадёт с WB-кабинетом (~83%).

---

## 🟢 Сделано в текущей итерации (PR #116 + после)

- ✅ RPC `get_pnl_by_period` v3 (R14 + cogs + tax + все расходы)
- ✅ RPC `get_daily_pnl_series` v3 (с cogs/tax + margin_pct)
- ✅ Расширенный `DailyPoint` (storage/acquiring/cogs/tax/marginPct)
- ✅ `/dashboard` новая раскладка (3 столбика + бриф+каналы + пульс)
- ✅ `/pnl` — таблица per-SKU + экспорт CF_PL.xlsx
- ✅ `PnLChart` (9 линий с чекбоксами, двойная Y-ось ₽/%) на /pnl и /dashboard
- ✅ `/products` каталог: убраны Канал/Бренд/Послед.продажа
- ✅ Tooltip на Метки/Хватит/TVV/Критичный SKU
- ✅ Категория = `subject_name`
- ✅ Бейдж «vs позавчера» с цветом
- ✅ KPI «Маржа» отдельной карточкой с дельтой в п.п.
- ✅ Топ-5 на дашборде
- ✅ Подписи каждой недели на графике
- ✅ Авто-гранулярность графика (день/неделя/месяц)
- ✅ PAD_X (Y-axis не обрезается)
- ✅ Фото fallback wbPhotoUrl + путь `/images/tm/1.webp`
- ✅ Прессы для чеснока — is_active=false
- ✅ Убран нерабочий поиск из топбара
- ✅ Убран «Маржа доступна с …» из брифа
- ✅ Логистический пульс над подписью «Данные из Supabase»
- ✅ Категории 3/5 + Аномалии 2/5
- ✅ Селекты фильтров каталога (Lifecycle / Margin / StockDays + кнопка «Сбросить»)
- ✅ Воронка query (entities/seller-analytics) — UI ещё не подключен
- ✅ Правила: rules.md §7 «UI без скролла», §8 «период 30д», §6 «не дёргать про токен»
- ✅ LLM_Wiki: те же 3 правила кросс-проектно

---

## 🔮 Backlog (отдельные задачи / новые edge functions)

### `fetch-wb-orders` (новый Edge Function)
- Источник: WB Statistics API `/api/v1/supplier/orders`
- Поля: orderId, date, nmId, totalPrice, srid, finishedPrice, cancelDt
- Таблица: `wb_orders_fact`
- Cron: каждые 30 минут (как `fetch-wb-sales-30min`)
- Заодно вкладка «Заказы» в WbStyleChart активируется.

### `fetch-wb-ads` (новый Edge Function)
- Источник: WB Promotion API `/adv/v1/...`
- Поля: campaignId, date, sumSpent, views, clicks, ctr, orders
- Таблица: `wb_ads_fact`
- Cron: ежедневно
- Использование: Маркетинг как реальная статья P&L (сейчас 0); вкладка «Продвижение» в WbStyleChart.

### `fetch-wb-content` (расширение)
- Заполнять `sku_catalog.rating` и `reviews_count` из WB Content API.

### `fetch-wb-funnel-aggregate`: окно 60 → 30 дней
- Параметр period в `supabase/functions/fetch-wb-funnel-aggregate/index.ts` → 30.
- Перезалить таблицу `wb_sales_funnel_period`.
- Цель: % выкупа в нашем UI = тот же что в WB-кабинете.

---

## 🟡 Открытые вопросы

- Фото: `tm/1.webp` — проверить после деплоя у всех 80 SKU
- График маржи поуже по высоте — отложено
