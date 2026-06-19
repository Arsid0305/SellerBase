# Tasks — SellerBase

> Живой TODO. Принцип: один список, один порядок приоритета. Устаревшие секции удаляем, не накапливаем.

---

## 🔴 Сейчас в работе

- [ ] **Telegram алерт по марже даёт неправильную цифру** — пришёл «🔴 Маржа упала на -10.0%», но в Excel владелицы за тот же период падение ~1%. Возможные причины: окно 7д vs 7д работает по неполным данным (отчёт WB лагает 1-2 дня → последний день полупустой → искусственное «падение»); или налоговая ставка/CoGS в `get_pnl_by_period` отличается от ручного расчёта; или revenue считается не так как в её Excel. **План:** сверить SQL формулу с эталоном Excel, добавить тест-кейс.
- [ ] **Telegram алерт cron** — снова показал «6 задач без успешного запуска». Проверить логику — может ловит окно за 24ч даже для тех cron которые weekly. Уже пытался зафиксить (whitelist + пороги), но видимо не задеплоилось ещё, либо логика не покрывает все случаи.
- [ ] **Фото в Топ-5 / Категории** — проверить визуально после деплоя что подгружаются через `tm/1.webp`
- [ ] **Левый/правый блоки одной высоты** — реализовано через `[&>*]:h-full`, проверить визуально

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
- **Лайфсайклы товаров** (Events / Anomaly / Trust-Visibility-Value / Goals)
- **Excel-экспорт** в шаблон владелицы (`templates/CF_PL_template_wb_only.xlsx`)
- **Office Add-in / Power Query** — отложено

---

## ⏸ Ждём от пользователя

- Excel «Заказы Китай», «Фулфилмент», «Поставки» — для автосебеса

---

## 🔵 Перспектива (записано, не делать без явного запроса)

- Google Sheets sync — на паузе по решению владелицы
