# SECURITY_PLAN — SellerBase

Single-tenant, режим «максимальной безопасности». Edge functions защищены
двумя независимыми слоями.

---

## Два слоя защиты edge functions

| Слой | Где проверяется                | Чем            | Что блокирует                                    |
|------|--------------------------------|----------------|--------------------------------------------------|
| 1    | Supabase (до запуска функции)  | `verify_jwt=true` в `config.toml` → проверка `Authorization: Bearer <JWT>` | Любой запрос без валидного Supabase JWT — 401. |
| 2    | Внутри функции (`_shared/auth.ts`) | сравнение `X-Cron-Secret` с `Deno.env.CRON_SHARED_SECRET` | Случайные внутренние вызовы без знания shared secret. |

Исключение: `telegram-webhook` — `verify_jwt=false`, т.к. Telegram шлёт
свой апдейт без Supabase JWT (защита через secret в URL пути / IP-список).

---

## Секреты

### Edge Function Secrets (`Deno.env`, через `supabase secrets set`)

- `WB_TOKEN_READ` — токен WB API.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — Telegram-алерты.
- `CRON_SHARED_SECRET` — сравнивается с заголовком `X-Cron-Secret`.
- Системные (авто): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.

### Supabase Vault (для pg_cron → net.http_post)

⚠️ **`ALTER DATABASE postgres SET app.settings.*` в Supabase НЕ РАБОТАЕТ** —
требует superuser, недоступного облачному пользователю. Старые рецепты с
`current_setting('app.settings.xxx', true)` нерабочие. Везде Vault.

| Имя в Vault          | Источник                                                |
|----------------------|---------------------------------------------------------|
| `cron_shared_secret` | Тот же hex что `CRON_SHARED_SECRET` в Edge Secrets.     |
| `service_role_key`   | service_role JWT, Dashboard → Settings → API → service_role. |

Установка (Dashboard → SQL Editor, выполняет владелица один раз):
```sql
SELECT vault.create_secret('<long-random-hex>',  'cron_shared_secret');
SELECT vault.create_secret('<service_role JWT>', 'service_role_key');
```

Чтение в миграциях cron:
```sql
coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = '...'), '')
```

### Риски ротации

- **service_role JWT ротируется** (Dashboard → Settings → API → Reset) →
  ВСЕ cron'ы начнут падать с 401 (verify_jwt отвергнет старый JWT).
  Перед ротацией: обновить Vault.
  ```sql
  UPDATE vault.secrets SET secret = vault.encrypted_secret('<новый JWT>')
  WHERE name = 'service_role_key';
  ```
- **`CRON_SHARED_SECRET` меняется** → обновить в обоих местах синхронно:
  ```bash
  supabase secrets set CRON_SHARED_SECRET='<новый hex>'
  ```
  ```sql
  UPDATE vault.secrets SET secret = vault.encrypted_secret('<тот же hex>')
  WHERE name = 'cron_shared_secret';
  ```

---

## Порядок раскатывания `verify_jwt=true`

Миграция `20260621100001_cron_with_service_role_jwt.sql` переплана 13 cron jobs
так чтобы они слали `Authorization: Bearer <service_role JWT>`.

**Не мержить PR до того как `service_role_key` появится в Vault** — иначе все
cron'ы будут падать с 401 пока миграция не доедет.

Последовательность:
1. Владелица: Dashboard → SQL Editor →
   `SELECT vault.create_secret('<service_role JWT>', 'service_role_key');`
2. Мерж PR → `migrate.yml` применяет миграцию → cron'ы начинают слать оба header'а.
3. `supabase functions deploy` (через CI) подхватывает новый `config.toml` с `verify_jwt=true`.

---

## Слой Auth (single-tenant, Supabase Auth magic-link)

Финальный слой, защищает само Next.js приложение (страницы + API routes).
Дополняет существующую Origin/Referer + X-API-Secret защиту, которая
теперь остаётся как defense in depth для `/api/*`.

### Что настроила владелица в Supabase Dashboard

- Authentication → Providers → Email = **on**, Magic Link = **on**.
- Authentication → Settings → Sign-up = **disabled** (новые юзеры не регистрируются).
- URL Configuration → Site URL = `<vercel-домен>`.
- URL Configuration → Redirect URLs = `<vercel-домен>/**`.
- Authentication → Users → Add user → её email с auto-confirm.

### Код

| Файл | Роль |
|------|------|
| `apps/web/src/middleware.ts` | Слой A: Supabase session. Нет user → редирект на `/login` (страницы) или 401 JSON (`/api/*`). Слои B/C (Origin, X-API-Secret) сохранены для `/api/*`. |
| `apps/web/src/app/(auth)/login/page.tsx` + `login-form.tsx` | Публичная страница. Email → `signInWithOtp` → «Письмо отправлено». |
| `apps/web/src/app/auth/callback/route.ts` | `exchangeCodeForSession(code)` → редирект на `/` или `/login?error=...`. |
| `apps/web/src/shared/lib/auth/require-auth.ts` | Хелпер для API routes: `{userId} \| NextResponse(401)`. |

### Где подключён `requireAuth()`

Все мутирующие (POST/PUT/DELETE/PATCH) handler'ы критичных routes:

- `POST /api/costs`
- `POST /api/costs/parse-xlsx`
- `POST /api/cargo-tariffs`
- `DELETE /api/demo/clear`
- `POST /api/import/china-order`
- `POST /api/import/unit-cogs`

Остальные мутирующие routes защищены middleware (401 для незалогиненных).
GET-only routes полагаются на RLS + middleware.

### Whitelist в middleware

`['/login', '/auth/callback', '/api/health']` — публичные пути.
Всё остальное требует session.

### Инструкция для владелицы — как залогиниться

1. Открыть `<vercel-домен>/login`.
2. Ввести email (тот же, который добавлен в Supabase Auth → Users).
3. Кликнуть «Прислать magic-link».
4. В почте кликнуть по ссылке → редирект на `/auth/callback` → session создаётся → редирект на `/`.
5. Дальше **~30 дней без повторного логина** (refresh token Supabase живёт долго).
