# Repository Audit — SellerBase

Универсальные проверки — см. **`llm_wiki/wiki/audit-universal.md`** (canon для всех репо).

Этот файл — тонкий overlay с проектной спецификой SellerBase.

Отчёты предыдущих аудитов — см. `docs/AUDIT_YYYY-MM-DD.md`.

---

## Контекст проекта

```
Тип: Data-платформа для управления бизнесом на маркетплейсах (замена Excel: UNIT, ПОСТАВКА, CF/PL)
MVP: Wildberries · Supabase + Edge Functions + Next.js
Стек: Next.js 15 / React 19, feature-sliced (apps/web: app, entities, features, widgets, shared) + Supabase (PostgreSQL + Edge Functions) + pnpm. Деплой фронта — Vercel (seller-base.vercel.app)
Bот: telegram-webhook
SSOT: sql/, supabase/migrations/
```

## Проектные проверки (в дополнение к universal)

**Supabase Edge Functions (критично):**
- [ ] **Каждая** функция имеет `verify_jwt: true` в `supabase/config.toml` (кроме `telegram-webhook`)
- [ ] service_role JWT в cron через `vault.decrypted_secrets`, НЕ в Edge Secrets
- [ ] X-Cron-Secret guard в edge functions запускаемых по расписанию
- [ ] `pg_advisory_lock` на входе каждой ingestion-функции — иначе зомби `running` записи

**Сверка репозитория с продом (добавлено 2026-08-21):**

Проверять не «применена ли миграция», а **есть ли в базе объекты, которые она создаёт**.
Сверка по именам не работает: имя в `supabase_migrations.schema_migrations` задаётся вручную
при `apply_migration` и с именем файла не совпадает
(`20260605_backfill_snapshots.sql` → `backfill_snapshots_30d`). Метод: вытащить
`CREATE TABLE|VIEW` из `supabase/migrations/*.sql`, сверить с `information_schema.tables`.

- [ ] Каждый объект из миграций существует в проде. Найденное 21.08: миграция
      `20260613_wb_goods_returns_events.sql` применилась частично — cron зарегистрирован,
      `CREATE TABLE` нет, функция падала ежедневно
- [ ] Каждая функция из `supabase/functions/` задеплоена в проект. Найденное 21.08:
      в репо 24, в проде 19, пять не задеплоены — три из них cron дёргал впустую
- [ ] Каждая функция объявлена в `supabase/config.toml`. Найденное 21.08: 17 из 24
- [ ] Cron вызывает функцию, которая существует. `cron.job_run_details.status = succeeded`
      **не означает успех** — pg_cron считает успехом постановку HTTP-запроса, а не ответ.
      Единственный достоверный источник — `ingestion_log`
- [ ] Каждая ingestion-функция пишет в `ingestion_log`, а не в свою таблицу. Найденное 21.08:
      `fetch-wb-supplies` писала в `integration_jobs`, которой в схеме нет — падала на записи
      лога, и вместе с ней терялась ошибка из `catch`
- [ ] `try_job_lock` / `release_job_lock` **вызываются** в коде, а не просто существуют в БД.
      Найденное 21.08: функции применены миграцией `job_advisory_locks` 20.06, не вызывает
      ни одна из 24 — отсюда 167 зомби-записей `running` у `fetch-wb-ads`

**Сырые данные (принцип №1 SYSTEM.md):**
- [ ] Каждая ingestion-таблица имеет колонку `raw JSONB` с ответом API как есть.
      Найденное 21.08: `raw` есть у 7 таблиц `wb_*` из 23. Проверено на практике —
      WB сменил формат возвратов (`reason` → `returnType`, `returnDate` → `completedDt`),
      и починить маппинг без потери данных удалось только потому, что `raw` был сохранён.
      Где `raw` нет — смена формата означает молча записанные пустые поля
- [ ] Имена колонок в нормализованном слое — `snake_case`, не camelCase из API.
      WB переименовывает поля между версиями и называет одно и то же по-разному
      в разных своих API (`nmId` / `nmID` / `nm_id`). Слой имён — это буфер,
      который отвязывает 36 view, RPC и фронт от переименований на стороне WB

**Миграции:**
- [ ] Отдельный файл на каждую миграцию, timestamp `YYYYMMDDHHMMSS_<snake>.sql`
- [ ] **Никогда** не править прошлые применённые миграции
- [ ] Применение через MCP `mcp__Supabase__apply_migration`, не CLI

**Данные / формулы:**
- [ ] Нет двух конкурирующих версий формулы в проде (прецедент: `margin-analyzer` v1+v2)
- [ ] Ручное поле (`cost_price_rub`) явно помечено в схеме (`cost_price_source`)
- [ ] Сверка `.range()` vs новой RPC до коммита (`tasks/rules.md §16`)
- [ ] Финансовая формула сначала на эталонной неделе с известными цифрами, потом раскатывается

**UI:**
- [ ] Страница помещается в 1366×768 без горизонтального скролла
- [ ] Дефолтный период метрик = период UX источника (WB-кабинет → 30 дней)

**Промпты сессии:**
- [ ] `tasks/SESSION_LOG.md` обновлён верхней записью после сессии (append-only)
- [ ] `tasks/todo.md`: `[актуально]` секция сверху, предыдущая → `[устарело]`

## Формат отчёта

Как в `llm_wiki/wiki/audit-universal.md`.
