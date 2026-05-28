# SellerBase — план разработки

## Контекст

Цель: заменить Excel-комплекс единой data-платформой для управления бизнесом на WB.

Стек: Supabase + Edge Functions + Lovable. На старте фронт = Google Sheets sync + Lovable параллельно.

---

## Принципы надёжности и расширяемости

1. **Сырые данные отдельно от расчётных** (`*_raw` JSON из API → нормализатор → `*_fact`).
2. **Idempotent UPSERT** по бизнес-ключу.
3. **`ingestion_log`** — здоровье системы.
4. **Расчёты — только VIEW**.
5. **Декомпозиция view** — маленькие → большие.
6. **`v_data_quality`** — sanity-checks.
7. **`app_settings`** — key/value для внутренних коэффициентов.
8. **История** у всего что меняется.
9. **Расширение через добавление**, не переписывание.
10. **Edge Functions ловят ошибки в `ingestion_log`**.

---

## Phase 1 — Bootstrap + initial schema ✅

7 таблиц + helpers + RLS. Seed `app_settings`.

## Phase 2 — Сбор данных WB — код готов, ждёт токен

Edge Function `fetch-wb-stocks` в репо. После токена — деплой и cron.
Дальше: `fetch-wb-report`, `fetch-wb-ads`.

## Phase 3 — Расчётный движок ✅

10 view с `security_invoker=on`. На пустых данных всё пока пусто, кроме `v_data_quality` (7 SKU без cost_price).

## Phase 4 — Модуль Китай/COGS ✅

6 таблиц + `cost_price_at()`. Структура 1:1 с твоим Excel.
Дальше: UI-форма в Lovable + импорт твоего файла.

## Phase 5 — Интерфейс

- `sync-sheets` Edge Function stub — ждёт `GOOGLE_SA_JSON` + `GOOGLE_SHEET_ID`.
- Lovable web-дашборд — когда будут первые данные из WB.

## Phase 6 — Тестирование и переход

## Phase 7 — Ozon, AI, Telegram-бот, mobile.
