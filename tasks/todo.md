# Tasks — SellerBase

> Живой TODO. Принцип: один список, один порядок приоритета. Устаревшие секции удаляем, не накапливаем.

---

## 🔴 Сейчас в работе

- [ ] **🚨 WorktreeCreate hook для Claude Code (СРОЧНО)** — без хуков параллельные subagent'ы работают в одной рабочей копии, переключают ветки друг у друга → каша с коммитами (пример 21.06.2026: vitest-агент закоммитил orders-refactor с чужим заголовком, разгребали руками). Настроить в `~/.claude/settings.json` хуки `WorktreeCreate`/`WorktreeRemove` через `git worktree add/remove`. Параллельная работа агентов сейчас сломана во всех 9 репо. Зафиксировано в `AI_OS/MEMORY/tasks/cross-repo-todo.md` (🔴 высокий приоритет).
- [ ] **Фото в Топ-5 / Категории** — проверить визуально после деплоя что подгружаются через `tm/1.webp`
- [ ] **Левый/правый блоки одной высоты** — реализовано через `[&>*]:h-full`, проверить визуально

---

## ⏸ Требует решения владелицы

- **🔒 Макс. безопасность (3 пункта) + multi-tenant fork** — план собран в `docs/SECURITY_PLAN.md`. Решение владелицы (21.06): «сделать максимально безопасно». Готов к запуску агентов (A: verify_jwt+JWT в pg_cron, B: Supabase Auth magic-link + middleware + /login). После их PR'ов — 15-минутная сессия владелицы в Supabase Dashboard (5 шагов в `SECURITY_PLAN.md`). Ждёт «делай». **Триггерные фразы для выдачи плана: «безопасность», «план по безопасности», «друзьям предложить», «Dashboard сессия».**
- **Multi-tenant fork** (если когда-нибудь подключать друзей) — 3 варианта (A/B/C) + 5 вопросов в `docs/SECURITY_PLAN.md`. Рекомендация по умолчанию: Вариант A + параллельный `docs/MULTI_TENANT_PLAN.md`.

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
