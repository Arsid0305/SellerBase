# Tasks — SellerBase

> Живой TODO. Принцип: один список, один порядок приоритета. Устаревшие секции удаляем, не накапливаем.

---

## 🔴 Сейчас в работе

- [~] **PR #175 — 4 карточки утреннего брифа (заказы + выкупы)** — жду визуальной проверки.

## 🟡 Очередь UX-фиксов (по одному, после визуальной проверки каждого)

> Правило: один баг → фикс → визуальная проверка → следующий. Не скопом.

1. [~] **Средняя маржа 58.3% (Продажи за 30 дней)** — взвешенная по выручке вместо простого среднего процентов. Открыт PR (avg-margin-fix). _Скрин: 2026-06-25._
2. [ ] **/pnl — нет KPI-цифр перед графиком** — открываешь страницу «Прибыль и убытки» и сразу видишь только график без чисел. Добавить блок 4 KPI **сверху**: Доходы / Расходы / Прибыль / Маржа% (за выбранный период). _Скрин: 2026-06-25._
3. [ ] **/pnl — структура доходов отсутствует** — есть «Структура расходов», но нет «Структура доходов» (разбивка по каналам / категориям / SKU). Симметричный блок добавить. _Скрин: 2026-06-25._
4. [ ] **Критичные SKU: ссылка → отдельная страница** — сейчас «Критичных SKU: N» в брифе ведёт на `/products?status=critical` (общий каталог). Должна вести на страницу со списком только критичных + указанием причины (out-of-stock / нет продаж 14+ дней / другое). _Скрин: 2026-06-25._
5. [ ] **Матрица ABC × PPP — клик по квадратику** — `/analytics`: при клике на любой квадрат (например «PPP × A: 4 шт») переход на список товаров **именно из этой группы**. Сейчас не кликабельно. _Скрин: 2026-06-25._
6. [ ] **Матрица XYZ оборачиваемости — клик по карточке** — то же что ABC×PPP: клик на «X: 0 шт», «Y: 0 шт», «Z: 79 шт» → список SKU из этой группы. _Скрин: 2026-06-25._
7. [ ] **Русифицировать английские слова в UI** — на /products/costs и других: «cost», «cost_price», «CSV», «Шаблон Excel», «UNIT (XLSX)». Заменить на русские эквиваленты, не трогая SQL/имена БД-колонок. _Скрин: 2026-06-25._
8. [ ] **Себестоимость: ручной ввод полей вместо только Excel** — в `/products/costs` дать возможность редактировать данные inline в ячейках таблицы, не только через файлы. _Скрин: 2026-06-25._

## ⏸ Большие задачи на ожидании

- [ ] **PR-B v2 fetch-wb-supplies** — переделать под FBW Supplies API (POST `/api/v1/supplies` + GET `/api/v1/supplies/{ID}/goods` на host `supplies-api.wildberries.ru`). Прежняя версия на `/api/v1/supplier/incomes` вернула WB 404. Свежий swagger — `https://dev.wildberries.ru/swagger/orders-fbw` (требует VPN).
- [ ] **PR-C delivery_to_wb_invoices** — после PR-B v2: таблица счетов от ФФ за доставку поставки + UI «Поставки» + автоматический расчёт `delivery_to_wb_rub_per_unit`.
- [ ] **🚨 WorktreeCreate hook** — сделан в этой сессии (`AI_OS/.claude/hooks/worktree-*`), требует проверки на параллельных subagent'ах.
- [ ] **Фото в Топ-5 / Категории** — проверить визуально после деплоя что подгружаются через `tm/1.webp`
- [ ] **Левый/правый блоки одной высоты** — реализовано через `[&>*]:h-full`, проверить визуально

---

## 🟢 Готовы к merge (16 PR от 20-21.06)

Все зелёные на CI (Vercel preview success, типы и билд проходят). 7 PR с включённым `enable-automerge` сольются автоматически, остальные нужно мерджить вручную или ре-триггерить CI.

### С enable-automerge — сольются сами:
- **#159** test(vitest): unit-тесты финансовых формул (50 кейсов в 7 файлах)
- **#158** refactor(fetch-wb-orders): paginateByLastChangeDate с onPage-callback
- **#156** docs(todo,rules): закрыть выполненное + §16 правило сверки RPC

### БЕЗ enable-automerge — нужен ручной merge или re-trigger CI:
- **#157** refactor(wb-client): paginateByLastChangeDate финиш + миграция fetch-wb-sales
- **#155** refactor(rpc): xlsx-export через RPC (9/9 range)
- **#154** refactor(rpc): sales-report (8/9)
- **#153** refactor(rpc): analytics (7/9)
- **#152** refactor(rpc): catalog (6/9)
- **#151** refactor(rpc): business-snapshot ×3 функции (5/9)
- **#150** refactor(rpc): price-simulator (4/9)
- **#149** refactor(rpc): sources (3/9)
- **#148** refactor(rpc): supplies (2/9)
- **#147** refactor(rpc): data-quality channelGaps (1/9)
- **#146** security(cron): X-Cron-Secret guard в 10 edge functions
- **#145** refactor(wb): унификация fetch-wb-{sales,orders,ads} через _shared/wb-client.ts

### Чужая ветка (PR #144 на `claude/funny-cerf-s37pkh`):
- **#144** feat(autosebes): 3 доп тарифа + extend v_sku_cost_breakdown + FF Excel — это автосебес-задача с предыдущей сессии, не из этой.

---

## ⏸ Требует решения / приостановлено владелицей

- **🔒 Макс. безопасность (3 пункта)** — решение владелицы 21.06: **«всё оставляем как есть, ничего не меняем по входу»**. План полностью зафиксирован в `docs/SECURITY_PLAN.md` (verify_jwt + service_role JWT в pg_cron + Supabase Auth magic-link + 15-минутная Dashboard-сессия). **Триггерные фразы для возобновления: «безопасность», «план по безопасности», «друзьям предложить», «Dashboard сессия».** Текущая защита: `X-Cron-Secret` (PR #146 после мерджа) + Origin/Referer гигиена (PR #138).
- **Multi-tenant fork** (если когда-нибудь подключать друзей) — решение 21.06: **«делаем пока только для меня»**. План в `docs/SECURITY_PLAN.md` (3 варианта + 5 вопросов) + детальный чек-лист в `docs/MULTI_TENANT_PLAN.md`. Возобновить когда «созреет».

---

## 🟡 Можно делать в фоне без согласования (все ✅ закрыты в этой сессии)

- ✅ **`.range(0, 200_000) × 9 файлов` → RPC агрегация** — 9 PR (#147-155). Каждый со сверкой старое=новое через MCP execute_sql.
- ✅ **CRON_SHARED_SECRET helper для 10 edge functions** — PR #146. После мерджа — 2 команды от владелицы (см. `docs/SECURITY_PLAN.md`).
- ✅ **wb-client.ts helpers + paginateByLastChangeDate** — PR #145, #157, #158.
- ✅ **Vitest + 50 кейсов финансовых формул** — PR #159 (classifyProfit/Sales/Stability, buildRecommendation, computeBreakEven, business-rules snapshots).
- ✅ **WorktreeCreate hook** — задача зафиксирована (требует ручной настройки `~/.claude/settings.json`).

---

## 🔮 Backlog (новые Edge Functions / большие фичи)

- **Автоматический себес** roadmap — в работе на ветке `claude/funny-cerf-s37pkh`, PR #144.
- **TVV (Видимость/Доверие/Ценность)** — ⏸ отложили
- **Goals по SKU** — ⏸ отложили
- **Office Add-in / Power Query** — ⏸ отложено
- **Импорт 22 старых бланков заказов Китай** — ⏸ отложено (после стабилизации БД)

---

## ⏸ Ждём от пользователя

- Excel «Фулфилмент», «Поставки» — для автосебеса (Excel Заказов Китай уже импортируется через `/products/costs`)
- **После мерджа PR #146** — установить `CRON_SHARED_SECRET` в Supabase Secrets (см. `docs/CRONS.md` + `docs/SECURITY_PLAN.md`)

---

## 🔵 Перспектива (записано, не делать без явного запроса)

- Google Sheets sync — на паузе по решению владелицы
- Полный multi-tenant (sign-up + billing + org-isolation) — см. `docs/MULTI_TENANT_PLAN.md`
