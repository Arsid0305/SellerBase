# SellerBase

Data-платформа для управления бизнесом на маркетплейсах. Замена Excel-комплекса (UNIT, ПОСТАВКА, CF/PL).

**MVP:** Wildberries · Supabase + Edge Functions · Next.js на Vercel.

## С чего начать

| Я хочу… | Открыть |
|---------|---------|
| Возобновить работу с прошлой сессии | [tasks/SESSION_LOG.md](tasks/SESSION_LOG.md) (верхняя запись = точка входа) |
| Понять, что в системе есть и что работает | [docs/PLAN.md](docs/PLAN.md) |
| Текущие задачи и приоритеты | [tasks/todo.md](tasks/todo.md) |
| Работать с карточками товаров и SEO | [docs/seo/README.md](docs/seo/README.md) |
| Коды ТН ВЭД и «Честный ЗНАК» | [docs/marking/codes-marking.md](docs/marking/codes-marking.md) |
| Понять правила работы ИИ в репо | [CLAUDE.md](CLAUDE.md) · [SYSTEM.md](SYSTEM.md) |
| Правила проекта | [tasks/rules.md](tasks/rules.md) |
| Уроки/паттерны | `arsid0305/llm_wiki/wiki/lessons.md` (в этом репо своего файла нет) |
| Расписания cron | [docs/CRONS.md](docs/CRONS.md) |
| Провести аудит | [docs/AUDIT_PROMPT.md](docs/AUDIT_PROMPT.md) |
| Разбор внешних аудитов 04.09 | [docs/AUDIT_2026-09-04_RAZBOR.md](docs/AUDIT_2026-09-04_RAZBOR.md) |
| Безопасность | [SECURITY.md](SECURITY.md) |

## Стек

- Frontend: Next.js 15 / React 19, feature-sliced (`apps/web`), TanStack Query и Table, Tailwind
- Backend: Supabase — PostgreSQL, Edge Functions, `pg_cron` + `pg_net`, Vault
- Package manager: pnpm, монорепо
- SQL: всё в `supabase/migrations/` — и таблицы, и view (21 миграция создаёт view)
- Бот: `telegram-webhook` + `telegram-alerts`

## Структура

```
apps/web/             — фронтенд (Next.js): app, entities, features, widgets, shared
supabase/
  functions/          — Edge Functions (27 шт.) + _shared
  migrations/         — миграции, включая все view
scripts/              — вспомогательные скрипты (сборка книги карточек, импорт выгрузок)
branding/             — брендинг / assets
docs/                 — состояние системы, аудиты, cron, SEO-контур, маркировка
tasks/                — todo / SESSION_LOG / rules + книги владелицы в excel-from-owner/
```

## Инфраструктура

- Репо: `github.com/Arsid0305/SellerBase`
- Supabase: проект `hcebwgjgppwaguqittpi`
- Фронт: `seller-base.vercel.app`

**GitHub Actions отключены с 11.07.2026** после срабатывания anti-abuse — workflow-файлы
на месте, но не запускаются. Практические следствия:

- PR мержатся вручную, `automerge.yml` не сработает
- Edge Functions деплоятся через MCP `deploy_edge_function`, не через CI
- миграции применяются через MCP `apply_migration`

Подробности и способ ручного запуска функций — в [docs/PLAN.md](docs/PLAN.md).
