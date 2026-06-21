# Tasks — SellerBase

> Живой TODO. Принцип: один список, один порядок приоритета. Устаревшие секции удаляем, не накапливаем.

---

## 🔴 Сейчас в работе

- [ ] **Фото в Топ-5 / Категории** — проверить визуально после деплоя что подгружаются через `tm/1.webp`
- [ ] **Левый/правый блоки одной высоты** — реализовано через `[&>*]:h-full`, проверить визуально

---

## ⏸ Требует решения владелицы

- **`verify_jwt = true` на edge functions** — альтернатива X-Cron-Secret из PR #146. Требует service_role JWT в pg_cron + app.settings.* в БД.
- **Реальная Auth для API routes** (`/api/costs`, `/api/demo/clear`) — Supabase Auth session в middleware. Сейчас 2-уровневая Origin/Referer (PR #138).

---

## 🟡 Можно делать в фоне без согласования

- ✅ **Vitest + unit-тесты финансовых формул** — в работе (агент)
- ✅ **`paginateByLastChangeDate` финиш** — в работе (агент)
- ✅ **`.range(0, 200_000) × 11` → RPC агрегация** — закрыто (9 PR: data-quality, supplies, sources, price-simulator, business-snapshot ×3 функции, catalog, analytics, sales-report, xlsx). Каждый — со сверкой старое=новое.
- ✅ **CRON_SHARED_SECRET в 10 edge functions** — PR #146 (см. action для владелицы ниже).
- ✅ **wb-client.ts helpers для fetch-wb-{sales,orders,ads}** — PR #145.

---

## 🔮 Backlog (новые Edge Functions / большие фичи)

- **Автоматический себес** roadmap: `china_order_items` + `supplies_transport` + `fulfillment_costs` + `delivery_to_wb` → view `v_sku_cost_breakdown` (в работе на ветке `claude/funny-cerf-s37pkh`, PR #144)
- **Лайфсайклы товаров** (Events / Anomaly / Trust-Visibility-Value / Goals):
  - ⏸ TVV (Видимость/Доверие/Ценность) — **отложили**
  - ⏸ Goals по SKU — **отложили**, цели по магазину пока достаточно
- **Office Add-in / Power Query** — отложено
- **Импорт 22 старых бланков заказов Китай** — отложено

---

## ⏸ Ждём от пользователя

- Excel «Фулфилмент», «Поставки» — для автосебеса (Excel Заказов Китай уже импортируется через `/products/costs`)
- **Установить `CRON_SHARED_SECRET`** в Supabase Secrets + `ALTER DATABASE postgres SET app.settings.cron_shared_secret = '<тот же>'` — после мерджа PR #146 (см. `docs/CRONS.md`)

---

## 🔵 Перспектива (записано, не делать без явного запроса)

- Google Sheets sync — на паузе по решению владелицы
