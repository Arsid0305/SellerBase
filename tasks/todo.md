# Tasks — SellerBase

> Живой TODO. Принцип: один список, один порядок приоритета. Устаревшие секции удаляем, не накапливаем.

---

## 🔴 Сейчас в работе

- [ ] **Фото в Топ-5 / Категории** — проверить визуально после деплоя что подгружаются через `tm/1.webp`
- [ ] **Левый/правый блоки одной высоты** — реализовано через `[&>*]:h-full`, проверить визуально

---

## ⏸ Требует решения владелицы (из аудита 2026-06-20)

- **`.range(0, 200_000)` в 11 файлах** → агрегация в БД. Большой рефакторинг, требует RPC per use-case с риском изменить семантику формул. Решить вместе.
- **Удалить `get_pnl_by_period` миграцией** (RPC дубль) — все 3 потребителя переключены на `get_full_pnl_by_period`, можно удалять. Решить когда есть окно простоя.
- **Подключить shared secret в edge functions** (`_shared/auth.ts` готов). Установить `CRON_SHARED_SECRET` в Supabase + обновить cron-команды чтобы добавляли header X-Cron-Secret. Требует одновременной координации.
- **Migrate fetch-wb-sales/orders/ads на `_shared/wb-client.ts`** — helper готов, нужна аккуратная мигрция с тестированием.

---

## 🔴 Дальше после дашборда (по приоритету)

1. ~~migrate.yml workflow~~ ✅ уже есть — `.github/workflows/migrate.yml` с `supabase db push --include-all` на push в main с изменениями в `supabase/migrations/**/*.sql`. Требует секреты `SBP_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD`.
2. ~~Документация cron'ов~~ ✅ `docs/CRONS.md` — таблица 5 активных cron + 9 функций без cron + команды управления + секреты.

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

- ✅ **Granularity picker** — `shared/ui/domain/granularity-picker.tsx` + `shared/lib/granularity.ts` (компонент готов, интеграцию в страницы — точечно по запросу)
- ✅ **Анализатор маржи «почему падает»** — `/margin-analyzer` (главный виновник + рекомендация)
- ✅ **Точка безубыточности** — карточка в `/products/[id]`
- ✅ **Симулятор цены** — `/price-simulator` (слайдер + KPI маржи/прибыли)
- ✅ **Telegram алерты** — edge function `telegram-alerts` + cron 11:00 МСК (5 проверок). Требует deploy + секреты `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`
- ✅ **Data Quality view** — `/data-quality` (10 метрик)
- ✅ **Smoke-тесты Playwright** — `apps/web/tests/e2e/smoke.spec.ts` (19 страниц)
- ✅ **Юнит-тесты SQL-формул** — `supabase/tests/*.sql` (P&L 14 тестов, оборачиваемость 8, ABC skip). Запуск: `pg_prove -d $DATABASE_URL supabase/tests/*.sql`

---

## 🔮 Backlog (новые Edge Functions / большие фичи)

- **`fetch-wb-orders`** → вкладка «Заказы» в WB-style chart (Statistics API `/api/v1/supplier/orders`, таблица `wb_orders_fact`, cron 30 мин)
- **`fetch-wb-ads`** → вкладка «Продвижение» + Маркетинг как реальная статья P&L (`/adv/v1/...`, таблица `wb_ads_fact`, daily)
- ✅ **`fetch-wb-content`** — UPSERT rating + reviews_count + subject_name + last_content_sync_at; cron weekly вторник 09:00 МСК
- ✅ **Окно `fetch-wb-funnel-aggregate` 60 → 30 дней** — выкуп ~83% совпадёт с WB-кабинетом
- **Автоматический себес** roadmap: `china_order_items` + `supplies_transport` + `fulfillment_costs` + `delivery_to_wb` → view `v_sku_cost_breakdown`
- **Лайфсайклы товаров** (Events / Anomaly / Trust-Visibility-Value / Goals):
  - ⏳ Events log + Anomaly detection — **в работе** (агент)
  - ⏸ TVV (Видимость/Доверие/Ценность) — **отложили**: 3 KPI-блока в /products/[id] с пояснением каждой цифры + конкретной рекомендацией («Видимость 35 — продаётся 11 дней из 30 → запустить акцию»)
  - ⏸ Goals по SKU — **отложили**, цели по магазину пока достаточно
- **Excel-экспорт** в шаблон владелицы (`templates/CF_PL_template_wb_only.xlsx`)
- **Office Add-in / Power Query** — отложено
- **Импорт 22 старых бланков заказов Китай** — отложено (после стабилизации БД). У владелицы 22 предыдущих бланка заказов с курсами юаня. Цель: ретроспективно создать историю китайских закупок и пересчитать себестоимость партий. Когда: после завершения всех текущих фич и аудита.

---

## ⏸ Ждём от пользователя

- Excel «Заказы Китай», «Фулфилмент», «Поставки» — для автосебеса

---

## 🔵 Перспектива (записано, не делать без явного запроса)

- Google Sheets sync — на паузе по решению владелицы
