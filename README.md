# SellerBase

Data-платформа для управления бизнесом на маркетплейсах. Замена Excel-комплекса (UNIT, ПОСТАВКА, CF/PL).

**MVP:** Wildberries · Supabase + Edge Functions + Lovable.

## С чего начать

| Я хочу… | Открыть |
|---------|---------|
| Возобновить работу с прошлой сессии | [tasks/SESSION_LOG.md](tasks/SESSION_LOG.md) (верхняя запись = точка входа) |
| Понять правила работы ИИ в репо | [CLAUDE.md](CLAUDE.md) · [SYSTEM.md](SYSTEM.md) |
| План разработки | [docs/PLAN.md](docs/PLAN.md) |
| Текущие задачи | [tasks/todo.md](tasks/todo.md) |
| Правила проекта | [tasks/rules.md](tasks/rules.md) |
| Уроки/паттерны | [tasks/lessons.md](tasks/lessons.md) |
| Безопасность | [SECURITY.md](SECURITY.md) |

## Стек

- Frontend: Lovable / React (monorepo — `apps/`)
- Backend: Supabase (PostgreSQL + Edge Functions)
- Package manager: pnpm
- SQL миграции: `sql/`, `supabase/`

## Структура

```
apps/                 — приложения (frontend)
sql/                  — SQL миграции и запросы
supabase/             — Edge Functions, конфиг Supabase
scripts/              — вспомогательные скрипты
branding/             — брендинг / assets
docs/                 — план + документация
tasks/                — todo / SESSION_LOG / rules / lessons
```

## Инфраструктура

- Репо: `github.com/Arsid0305/SellerBase`
- CI: `.github/workflows/` — `automerge.yml` (native GitHub auto-merge), `web-ci.yml`, `db-tests.yml`, `migrate.yml`, `deploy.yml`
