# Project Context — SellerBase

## 1. Tech Stack
- Frontend: Lovable (React + Vite + TS + Tailwind + shadcn/ui)
- Backend: Supabase Edge Functions (Deno/TypeScript)
- DB & Auth: Supabase (PostgreSQL)
- Design System: shadcn/ui (через Lovable)
- Animations: Framer Motion (по необходимости)

## 2. Infrastructure & CI/CD
- Frontend deploy: Vercel
- Repo: github.com/Arsid0305/SellerBase

Workflows (`.github/workflows/`):
- `automerge.yml` — авто-мерж `claude/...` и `cursor/...` веток в `main` ✅
- `deploy.yml` — деплой Supabase Edge Functions при пуше в `main` ✅

## 3. AI Environment

| Tool | Status | Note |
|------|--------|------|
| Node.js / npm | ✅ | |
| Python | ✅ | для ad-hoc скриптов |
| Supabase CLI | ❌ | используем MCP `apply_migration` |
| .env (real keys) | ❌ | все секреты в GitHub Secrets |

## 4. Design System

Lovable использует shadcn/ui по умолчанию. Перед UI-изменениями — open Lovable preview.

## 5. Project Structure

```
.github/workflows/     — CI/CD
docs/PLAN.md           — план разработки
tasks/todo.md          — активный чеклист
supabase/
  migrations/          — SQL миграции
  seed/                — начальные данные (app_settings)
  functions/           — Edge Functions (fetch-wb-*)
```

## 6. Standard Packages

Бэк (Edge Functions / Deno):
- `zod` — валидация входов
- `@supabase/supabase-js` — клиент

Фронт (Lovable):
- `lucide-react` — иконки
- `sonner` — toast-уведомления
- `date-fns` — даты
- `xlsx` — Excel импорт/экспорт

## 7. Auth (Supabase OTP)

- Step 1: `supabase.auth.signInWithOtp({ email })` — отправляет код
- Step 2: `supabase.auth.verifyOtp({ email, token, type: 'email' })` — проверяет
- Код — **8 цифр**

## 8. Внешние интеграции

- **WB API** — Statistics + Analytics + Promotion. Токен в `WB_API_TOKEN` (GitHub Secret).
- **Google Sheets API** — для двусторонней синхронизации с привычными таблицами. Service account JSON в `GOOGLE_SA_JSON`.

## 9. Open Bugs

_(empty)_
