# Repository Audit — SellerBase

Универсальные проверки — см. **`llm_wiki/wiki/audit-universal.md`** (canon для всех репо).

Этот файл — тонкий overlay с проектной спецификой SellerBase.

Отчёты предыдущих аудитов — см. `docs/AUDIT_YYYY-MM-DD.md`.

---

## Контекст проекта

```
Тип: Data-платформа для управления бизнесом на маркетплейсах (замена Excel: UNIT, ПОСТАВКА, CF/PL)
MVP: Wildberries · Supabase + Edge Functions + Lovable
Стек: React (Lovable) monorepo (apps/) + Supabase (PostgreSQL + Edge Functions) + pnpm
Bот: telegram-webhook
SSOT: sql/, supabase/migrations/
```

## Проектные проверки (в дополнение к universal)

**Supabase Edge Functions (критично):**
- [ ] **Каждая** функция имеет `verify_jwt: true` в `supabase/config.toml` (кроме `telegram-webhook`)
- [ ] service_role JWT в cron через `vault.decrypted_secrets`, НЕ в Edge Secrets
- [ ] X-Cron-Secret guard в edge functions запускаемых по расписанию
- [ ] `pg_advisory_lock` на входе каждой ingestion-функции — иначе зомби `running` записи

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
