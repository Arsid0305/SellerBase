# SQL unit-тесты (pgTAP)

Юнит-тесты SQL-формул для ключевых RPC и views: P&L, оборачиваемость, ABC/XYZ.

## Файлы

| Файл | Покрытие |
|---|---|
| `pnl_tests.sql` | `get_pnl_by_period` (revenue R14, commission, cogs, tax, net_profit, margin_pct), `get_daily_pnl_series` (агрегация по дням без дублей) |
| `turnover_tests.sql` | `v_turnover_by_sku` (turnover_days = stock_qty / avg_orders_per_day_28d, пороги 60/90, признаки "нет стока"/"нет продаж") |
| `abc_xyz_tests.sql` | ABC/XYZ классификация — **на 2026-06-17 не реализована в миграциях**, тест пропускается (`skip()`), оставлен шаблон на будущее |

Каждый файл самодостаточен: `BEGIN ... ROLLBACK` — фикстуры пишутся напрямую в реальные
таблицы (`sku_catalog`, `wb_reports_fact`, `wb_stocks`, `wb_sales_funnel`), но откатываются
в конце, в БД ничего не остаётся. Тестовые SKU используют `wb_article`/`nm_id` в диапазоне
`900000001-900000099`, чтобы не пересекаться с реальными данными.

## Требования

- PostgreSQL с расширением [pgTAP](https://pgtap.org/).
- Если pgTAP не установлен на инстансе:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pgtap;
  ```
  (на Supabase: Database → Extensions → pgtap, либо через миграцию).

## Запуск

### Вариант 1 — напрямую через psql

```bash
psql "$DATABASE_URL" -f supabase/tests/pnl_tests.sql
psql "$DATABASE_URL" -f supabase/tests/turnover_tests.sql
psql "$DATABASE_URL" -f supabase/tests/abc_xyz_tests.sql
```

Вывод — стандартный TAP-протокол (`ok 1 - ...`, `not ok 2 - ...`).

### Вариант 2 — через pg_prove (нужен `pg_prove` + `pgTAP`)

```bash
pg_prove -d "$DATABASE_URL" supabase/tests/*.sql
```

Даёт читаемую сводку pass/fail по каждому файлу.

### Вариант 3 — если pgTAP недоступен на инстансе

Тесты написаны через `plan()/is()/cmp_ok()/skip()/finish()` — без pgTAP не запустятся.
Если расширение нельзя установить (например, ограничения managed-плана), временный
fallback — переписать `is(actual, expected, msg)` на:

```sql
DO $$
BEGIN
  IF (actual_expr) IS DISTINCT FROM (expected_expr) THEN
    RAISE EXCEPTION 'FAIL: %', 'msg текста теста';
  END IF;
END $$;
```

В текущих файлах этого не сделано — predпочтение отдано pgTAP, так как он даёт
единый отчёт и привычный TAP-формат для CI.

## Важно

- Тесты **не коммитят** данные — каждый файл оборачивает свою работу в `BEGIN; ... ROLLBACK;`.
- Тесты рассчитаны на запуск на staging/preview БД с реальной схемой миграций
  (RPC используют `SET search_path TO ''`, поэтому подмена через временную схему
  не работает — фикстуры идут в реальные таблицы под тестовыми ID).
- Перед запуском убедиться что в `app_settings` есть ключ `tax_rate` — тест
  `pnl_tests.sql` явно перезаписывает его на `0.06` для детерминизма и откатывает
  это вместе со всем остальным в `ROLLBACK`.
