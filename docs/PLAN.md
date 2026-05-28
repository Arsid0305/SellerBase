# SellerBase — план разработки

## Контекст

Цель: заменить Excel-комплекс (UNIT ПЛАН, UNIT WB факт, ПОСТАВКА, АНАЛИТИКА CF/PL) единой data-платформой для управления бизнесом на WB.

Что нужно по итогу:
- Автосбор данных с WB API.
- Единая БД (Supabase/PostgreSQL).
- Расчётный движок: unit-экономика, P&L, Cash Flow, оборачиваемость, реклама, поставки.
- Лёгкий, понятный, легко правимый интерфейс под соло-владельца.

Что зафиксировано:
- MVP — **только WB**.
- Стек: **Supabase + Edge Functions + Lovable**.
- Фронт на старте — **C (Google Sheets sync)** + **A (Lovable)** параллельно.
- Стартовая схема — **3 базовые таблицы** + служебные (`app_settings`, `ingestion_log`, `*_raw`, `*_history`).

Принцип: **данные → структура → движок → интерфейс**, не наоборот.

---

## Принципы надёжности и расширяемости (фундамент)

1. **Сырые данные отдельно от расчётных.** `*_raw` (JSON из API, неизменно) → нормализатор → `*_fact` (чистые цифры).
2. **Idempotent UPSERT** по бизнес-ключу. Cron можно гонять сколько угодно раз — дублей не будет.
3. **`ingestion_log`** — каждый запуск фетчера пишет статус. Один экран здоровья системы.
4. **Расчёты — только `VIEW`**, не таблицы. Поправил формулу = пересчиталось всё. Новый отчёт = новая view, без миграций.
5. **Декомпозиция view сверху вниз** — большая собирается из маленьких. Сломалась маленькая — видно где; большая отдаст «нет данных», а не неверные цифры.
6. **`v_data_quality`** — sanity-checks как view. Отрицательная маржа при положительной выручке, отсутствие данных, нулевая себестоимость активного SKU. Подсвечиваются красным в UI.
7. **`app_settings`** (key/value) — все внутренние коэффициенты. Ставка налога, страховой запас, окно скорости продаж, lead time, целевая маржа, метод аллокации карго. WB-комиссии берутся пер-артикул из `wb_reports_fact`, не из настроек.
8. **История у всего что меняется.** `cogs_history`, `wb_tariffs_*_history`, `wb_stocks_history`.
9. **Расширение только через добавление**, не переписывание. Новый параметр → строка в `app_settings`. Новая колонка → `alter add column ... default ...`. Новая таблица → отдельная миграция. Новый отчёт → новая view. Новый источник (Ozon) → отдельные `ozon_*` таблицы.
10. **Edge Functions ловят ошибки в `ingestion_log`** и не падают с пустыми руками. WB API недоступен → старые данные на месте.

---

## Phase 1 — Bootstrap + первая миграция ✅

Сделано в этом PR.

Содержимое `0001_initial_schema.sql`:
- `sku_catalog`, `wb_reports_fact_raw`, `wb_reports_fact`, `wb_stocks`, `wb_stocks_history`, `app_settings`, `ingestion_log`.
- Helpers: `app_setting_num()`, `app_setting_text()`.
- Уникальные ключи под UPSERT.

Seed `app_settings`: `tax_rate`, `safety_stock_days`, `sales_velocity_window`, `china_lead_time_days`, `target_margin`, `cogs_allocation_method`, `cny_default_rate`.

---

## Phase 2 — Сбор данных WB (Data Ingestion)

**Технология:** Supabase Edge Functions (Deno/TS) + `pg_cron`.

**Эндпоинты в порядке внедрения:**
1. `/api/v1/supplier/stocks` — остатки, ежедневно. Первый практический результат.
2. `/api/v1/supplier/reportDetailByPeriod` — отчёт о реализации, еженедельно. Сразу даёт P&L.
3. `/adv/v1/promotion/*` — реклама, ежедневно.

**Правила на каждый фетчер:**
- UPSERT по бизнес-ключу.
- JSON → `*_raw` → нормализатор → `*_fact`.
- Запись в `ingestion_log` на каждый запуск.
- На ошибку — `status='error'`, `error_text`, выход. Прошлые данные не трогаем.

**Опционально для прогнозов:** `/api/v1/tariffs/box` + `/api/v1/tariffs/commission` → `wb_tariffs_*_history`.

---

## Phase 3 — Расчётный движок

SQL Views в Supabase. Маленькие → большие.

**Базовый слой:**
- `v_revenue_by_sku`, `v_commissions_by_sku`, `v_logistics_by_sku`, `v_ads_by_sku`, `v_sales_velocity`.

**Итоговый слой:**
- `v_pnl_by_sku` — чистая прибыль, %маржа. Налог из `app_settings`.
- `v_turnover` — дни до OOS.
- `v_warehouses_balance` — матрица SKU × склад, дисбаланс.
- `v_supply_recommendation` — `velocity × (lead_time + safety) − stock − in_transit`.
- `v_ads_roi` — ДРР, ROAS.
- `v_allocated_deductions` — аллокация штрафов/платной приёмки пропорционально продажам.
- `v_data_quality` — sanity-checks.

`cash_flow` и `marketing_expenses` — отдельной миграцией `0002_cash_flow.sql`, когда заполним остальное.

---

## Phase 4 — Модуль «Закупки Китай → Себестоимость»

Миграция `0003_china_cogs.sql`:
- `china_orders`, `china_order_items` (1:1 с твоим Лист1 + расчётный лист).
- `cargo_shipments` — общая стоимость отгрузки.
- `cogs_calculations`, `cogs_history`.

Аллокация карго: метод в `app_settings.cogs_allocation_method` (weight/volume/value/units).

Старт: Excel-импорт твоего файла через Supabase Studio CSV → параллельно UI-форма в Lovable.

---

## Phase 5 — Интерфейс

**Параллельно:**
- **A. Google Sheets sync** — Edge Function раз в час выгружает ключевые view в твои привычные таблицы.
- **B. Lovable web-дашборд** — SKU Dashboard, Cash Flow, Поставки, Закупки Китай, Настройки, Здоровье системы.

Запасной вариант: Retool/Appsmith.

---

## Phase 6 — Тестирование и переход

- Загрузить исторические данные за 4-8 недель.
- Сверить чистую прибыль с `UNIT WB факт 2025` → расхождение <1%.
- Деплой. Полный отказ от Excel.

---

## Phase 7 (после MVP)

- Telegram-бот.
- Ozon (отдельные `ozon_*` таблицы).
- AI-слой: прогноз продаж, anomaly detection, AI-ассистент.
- Mobile app (если Lovable окажется мало).
