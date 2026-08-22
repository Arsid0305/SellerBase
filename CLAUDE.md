# Claude Adapter — SellerBase

> Тонкий адаптер. Универсальное — в `arsid0305/ai_os/SYSTEM.md` и `arsid0305/llm_wiki/wiki/`.

## ⚠️ ПЕРВЫМ делом в любой новой сессии

Прочитать **`tasks/SESSION_LOG.md`** — самая верхняя запись = точка возобновления.

Дальше (порядок):
1. `arsid0305/ai_os/SYSTEM.md` — универсальное ядро для всех ИИ
2. `arsid0305/ai_os/CLAUDE.md` — Claude-специфика (краткость, subagents, agents @, skills)
3. `arsid0305/llm_wiki/wiki/lessons.md`, `wiki/decisions.md`, `wiki/projects.md`, `wiki/workflow.md` — кросс-проектные правила и решения
4. `SYSTEM.md`, `docs/PLAN.md`, `tasks/rules.md`, `tasks/todo.md` — специфика SellerBase

Если в SESSION_LOG есть «незакрытые вопросы» или «следующие шаги» — предложить продолжить с них. Не переспрашивать то что уже есть в SESSION_LOG.

---

## Что специфично для SellerBase

### Среда

| Инструмент    | Статус |
|---------------|--------|
| Python 3      | ✅ |
| Node.js       | ✅ |
| Supabase CLI  | ❌ (используем MCP `apply_migration`) |
| Deno локально | ❌ (но деплой возможен — см. ниже) |
| GitHub Actions| ❌ отключены с 11.07.2026 (anti-abuse). PR мержим вручную |
| .env реальный | ❌ (секреты в GitHub Secrets / Supabase Vault) |

### Деплой и запуск Edge Functions

**Деплой — через MCP `mcp__Supabase__deploy_edge_function`.** CI не работает с 11.07,
но это не значит, что деплоя нет. Передавать нужно и общие модули: для функции,
импортирующей `../_shared/auth.ts`, файл передаётся в `files` под тем же относительным
именем. `verify_jwt` — как в проде (`true` у всех, кроме `telegram-webhook`).

**Запуск вручную — из SQL**, тем же способом, что и cron. Секреты берутся из Vault,
знать их не нужно:

```sql
SELECT net.http_post(
  url := 'https://hcebwgjgppwaguqittpi.supabase.co/functions/v1/<имя>',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='service_role_key'),
    'X-Cron-Secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_shared_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 180000);
```

Результат смотреть в `public.ingestion_log`, **не** в `cron.job_run_details`:
pg_cron считает успехом постановку запроса, а не ответ функции.

### Миграции Supabase

- Отдельный файл на каждую миграцию, **никогда** не править прошлые применённые
- Применять через MCP `mcp__Supabase__apply_migration` (нет CLI)
- Для проверки данных — MCP `mcp__Supabase__execute_sql`
- Имя файла — timestamp `YYYYMMDDHHMMSS_<snake_case_description>.sql`

### Карточки товаров и SEO

Весь контур — от точки входа: **`docs/seo/README.md`**. Там иерархия раздела, порядок
действий и инструменты. Правило ведения — `tasks/rules.md` §17.

### Sверка при замене `.range()` на RPC

См. `tasks/rules.md §16` — обязательная сверка через `mcp__Supabase__execute_sql` старая логика vs новая RPC до коммита.

### Конец сессии — SESSION_LOG.md

В отличие от других репо где session-state в `tasks/todo.md` — SellerBase ведёт **отдельный `tasks/SESSION_LOG.md`** (append-only лог сессий).

Триггеры конца сессии распознавать **семантически** (см. `AI_OS/SYSTEM.md §8`). При триггере:
1. Дописать новую секцию **сверху** в `tasks/SESSION_LOG.md` — формат «## YYYY-MM-DD — заголовок \n### Контекст / ### Сделано / ### Открытые задачи / ### Следующие шаги».
2. Обновить `tasks/todo.md`: предыдущую `[актуально]` → `[устарело]`, новую сверху.
3. Закоммитить и запушить отдельным PR «docs: session log YYYY-MM-DD».

---

## Каноны (rules как атомы)

Универсальные правила — в `docs/rules/core/*.md` (SSOT в AI_OS, синкается автоматически):

- Начало / конец сессии, формат todo — [`docs/rules/core/session-lifecycle.md`](docs/rules/core/session-lifecycle.md) (у SellerBase свой SESSION_LOG — см. выше)
- Стиль общения / краткость — [`docs/rules/core/communication-style.md`](docs/rules/core/communication-style.md)
- Правила Git, PR flow, редактирование — [`docs/rules/core/git-flow.md`](docs/rules/core/git-flow.md)
- GitHub anti-abuse — [`docs/rules/core/github-anti-abuse.md`](docs/rules/core/github-anti-abuse.md)
- BIG / SMALL классификация — [`docs/rules/core/task-classification.md`](docs/rules/core/task-classification.md)
- Принципы работы с кодом — [`docs/rules/core/code-principles.md`](docs/rules/core/code-principles.md)
- Параллельные subagent'ы + worktree — [`docs/rules/core/subagents.md`](docs/rules/core/subagents.md)
- Audit-триггер — [`docs/rules/core/audit-trigger.md`](docs/rules/core/audit-trigger.md)
- Выбор модели `haiku` / `sonnet` / `opus` — `llm_wiki/wiki/workflow.md`
- Git/CI workflow (automerge, ветки, PR-flow) — `llm_wiki/wiki/workflow.md`
- context-mode защита окна — `llm_wiki/wiki/context-mode.md`
- Кросс-проектные уроки и решения — `llm_wiki/wiki/lessons.md`, `decisions.md`

**Специфика SellerBase (scoped-надстройка)**: см. `SYSTEM.md §4` (SMALL/BIG для SellerBase-слоёв, verification через `v_data_quality`, безопасность Edge Functions), `tasks/rules.md` (долгосрочные правила формул/эталонов/SEO).

Архитектура rules и правила синка — [`docs/rules/README.md`](docs/rules/README.md).
