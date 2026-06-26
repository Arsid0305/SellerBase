# Tasks — SellerBase

> Живой TODO. Принцип: один список, один порядок приоритета. Устаревшие секции удаляем, не накапливаем.

---

## Сейчас в работе

- 🟢 **PR #175 — 4 карточки утреннего брифа (заказы + выкупы)** — задеплоено, ждёт визуальной проверки.

## Очередь UX-фиксов (по одному, после визуальной проверки каждого)

> Правило: один баг → фикс → визуальная проверка → следующий. Не скопом.
> Легенда: 🟢 закрыто (оставляем как референс) · 🔴 не сделано · 🟡 в работе.

1. 🟢 **Средняя маржа 58.3% (Продажи за 30 дней)** — weighted avg по revenue (PR #176 merged) + deeper fix в `get_full_pnl_by_period` (PR #177). _Скрин: 2026-06-25._
2. 🟢 **Расхождение выручки между разделами** (PR #177 — `retail_amount` + унифицированное `rr_dt`-окно):
   - /products «Мои товары»: **197 940 ₽** = raw факт (`get_catalog_sales_daily`) ✅
   - /sales-report «Отчёт по продажам»: **197 940 ₽** = raw факт (`get_sales_report_daily`) ✅
   - /dashboard «Сводка»: **295 742 ₽** (`get_full_pnl_by_period`) ❌ +50%
   - /pnl «Прибыль и убытки»: **295 742 ₽** (`get_full_pnl_by_period`) ❌ +50%

   **Корень бага в `get_pnl_by_period`:**
   1. `SUM(retail_price × quantity)` — цена ДО скидки × шт. Должно быть `SUM(retail_amount)` (готовая сумма после скидки).
   2. Revenue считается по `sale_dt`, расходы по `rr_dt` — разные даты, период не сходится.

   Фикс: переписать `get_pnl_by_period` чтобы revenue был `SUM(retail_amount) WHERE doc_type IN ('Продажа','Возврат') AND rr_dt BETWEEN p_from AND p_to`. Сверить через MCP execute_sql до/после (rules.md §16).

3. 🟢 **/pnl — KPI-цифры перед графиком** (PR #182) — 4 KPI карточки (Доходы / Расходы / Прибыль / Маржа%) с delta vs прошлый период.
4. 🟢 **/pnl — структура доходов** (PR #182) — IncomeBreakdown по subject_name, симметрично ExpenseBreakdown.
5. 🟢 **Критичные SKU — отдельная страница /products/critical** (PR #181) — группировка по причинам (out_of_stock / no_sales_14d / other), MorningBrief ссылка обновлена.
6. 🔴 **Матрица ABC × PPP — клик по квадратику** — `/analytics`: при клике на любой квадрат (например «PPP × A: 4 шт») переход на список товаров **именно из этой группы**. Сейчас не кликабельно. _Скрин: 2026-06-25._
7. 🔴 **Матрица XYZ оборачиваемости — клик по карточке** — то же что ABC×PPP: клик на «X: 0 шт», «Y: 0 шт», «Z: 79 шт» → список SKU из этой группы. _Скрин: 2026-06-25._
8. 🟢 **Русифицирован UI на /products/costs** (PR #180) — заменены cost / CSV-headers / UNIT / XLSX на русские.
9. 🔴 **Себестоимость: ручной ввод полей вместо только Excel** — в `/products/costs` дать возможность редактировать данные inline в ячейках таблицы, не только через файлы. _Скрин: 2026-06-25._
10. 🔴 **/analytics/weekly — нет цифр** — раздел «Аналитика по неделям» (год 2026): Единиц продано 0, Выручка 0 ₽, Прибыль 0 ₽, Маржа 0.0%, график «Нет данных», таблица «Нет данных за 2026». Источник `sku_weekly_metrics` (импорт из `UNIT_WB по неделям 2026.xlsx`). Проверить: (а) есть ли данные в таблице, (б) запрос фильтра по году, (в) маппинг колонок при импорте. _Скрин: 2026-06-25._
11. 🟢 **Маржа 56% → 30% → 2.3%** (PR #179) — два шага в get_pnl_by_period: убран фильтр doc_type из exp CTE + запрос идёт от UNION(rev.nm_id, exp.nm_id) вместо sku_catalog. Остался не учтён marketing — задача 11a.
12. 🟢 **Средний чек 107 → 442 ₽** (PR #183) — orders = COUNT(DISTINCT srid) FILTER (doc_type_name=Продажа, quantity>0). Раньше считались все строки финотчёта.
13. 🟢 **«Отмены» → «Возвраты» в UI** (PR #183, частично) — поле cancellations в RPC = возвраты. Реальные отмены 13.1% — задача 13a (новая RPC по wb_orders_fact.date).
14. 🔴 **/promo (Промо-акции WB) — все колонки пустые** — матрица «80 товаров × 6 акций»: «Цена» —, «Маржа сейчас» —, и во всех колонках акций (Excel TEST Акция 1-4, Спортивные скидки, Жаркие скидки-2) у всех 80 SKU стоит «—». «Оборачив.» отрисована (например 1491 д) — значит данные товаров грузятся, но цена/маржа/участие в акциях не подтягиваются. Проверить: (а) RPC/запрос за `current_price` и `wb_promotions_fact`, (б) маппинг promotion_id → SKU. _Скрин: 2026-06-25._
18. 🔴 **/expenses (Мои расходы) — реализовать ручной ввод** — placeholder «Появится вместе с M2 (P&L)». Нужно: таблица manual_expenses + форма UI + подмешать в get_full_pnl_by_period отдельной строкой «Прочие расходы». _Скрин: 2026-06-25._
17. 🔴 **/tariffs (Тарифы и коэффициенты) — обновлять автоматически по понедельникам** — сейчас базовые тарифы логистики WB (Common Tariffs API) и индексы локализации/распределения «Обновлено 01.06» — старее месяца. Настроить cron: каждый понедельник в 06:00 MSK дёргать `fetch-wb-tariffs` (Common Tariffs API), записывать в `wb_tariffs_fact` с `effective_from = понедельник_недели`. Индексы локализации/распределения — оставить ручной ввод раз в неделю (как в подписи). _Скрин: 2026-06-25._
16. 🟢 **/reviews — бейдж «Демо-данные»** (PR #185, частично) — пометка что страница на mock-фикстуре. Полная интеграция WB Feedback API — задача 16a.
15. 🟢 **/deficit — только реально требующие поставки** (PR #184) — totalRows = outOfStock + critical + warning + filterRealDeficit() оставляет daysLeft≤14 или stock=0. Раньше показывало все 66 SKU.

### 🟡 Подзадачи (появились в работе)

- **11a — marketing в марже**: подключить `wb_ads_fact` (через `get_real_marketing_for_period`) в `get_full_pnl_by_period`. Сейчас `marketing_expenses` пустая, реклама не учитывается → маржа 2.3% возможно ещё чуть ниже реальности.
- **13a — реальные отмены**: в `wb_orders_fact` за 30д **13.1%** отмен. Нужна отдельная RPC по полю `date` (не `rr_dt`) + KPI карточка на /sales-report или /dashboard.
- **14a — fetch-wb-prices**: новая edge function + таблица `wb_prices_fact` + cron. Без неё /promo не покажет цены/маржу для не-участников акций.
- **16a — fetch-wb-feedback**: новая edge function + таблица `wb_feedback_fact` + RPC агрегаций → заменить mock на /reviews.

## 🔮 Перспектива (по концепции «всё в проге, никаких импортов»)

> Принцип: константы и заказы вводятся **в проге при каждой поставке**, прога считает поставки и **генерирует** ТЗ-ФФ. Долгосрочно WB-токен с правом записи → автопуш поставок в WB + ФФ.

- [ ] **История констант** — при каждом вводе курса юаня/доллара/доставки/себеса записывать снапшот (`tariff_constants_history`). На /dashboard «Сводка» отдельный график: курсы (CNY/USD/доставка) + себес-перевешенная средняя + продажи на одном тайм-лайн — видно как изменения констант влияют на маржу.
- [ ] **Калькулятор поставки** — UI на основе `v_supply_recommendation`: прога считает qty per склад по продажам / остаткам / lead_time / safety_stock. Кнопка «Создать поставку» → попадает в `wb_supplies_planned`.
- [ ] **Генератор ТЗ-ФФ** — экспорт Excel (или CSV) из калькулятора поставки → файл скачивается → отправляешь ФФ. Заменяет ручную работу с шаблоном.
- [ ] **WB Write API integration** — `/api/v1/supplies` POST для создания поставок на WB прямо из проги (нужен WB-токен с write-правом).
- [ ] **Форма «Новый заказ Китай»** — UI ввода **строго по структуре файла владелицы** `Order_china_*.xlsx` (поля и порядок 1:1 как в Excel). Заменит импорт. Парсер `china-order` уже знает структуру — переиспользовать те же поля в форме.

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
